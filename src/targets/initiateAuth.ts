import {
  InvalidUsernameOrPasswordError,
  NotAuthorizedError,
  PasswordResetRequiredError,
  UnsupportedError,
} from "../errors";
import { CodeDelivery, Services, UserPoolClient } from "../services";
import { generateTokens } from "../services/tokens";
import { attributeValue, User } from "../services/userPoolClient";

interface Input {
  AuthFlow: "USER_PASSWORD_AUTH" | "CUSTOM_AUTH";
  ClientId: string;
  AuthParameters: { USERNAME: string; PASSWORD: string };
  Session: string | null;
}

export interface SmsMfaOutput {
  ChallengeName: "SMS_MFA";
  ChallengeParameters: {
    CODE_DELIVERY_DELIVERY_MEDIUM: "SMS";
    CODE_DELIVERY_DESTINATION: string;
    USER_ID_FOR_SRP: string;
  };
  Session: string | null;
}

export interface PasswordVerifierOutput {
  ChallengeName: "PASSWORD_VERIFIER";
  ChallengeParameters: {};
  Session: string | null;
  AuthenticationResult: {
    IdToken: string;
    AccessToken: string;
    RefreshToken: string;
  };
}

export interface NewPasswordRequiredOutput {
  ChallengeName: "NEW_PASSWORD_REQUIRED";
  ChallengeParameters: {};
  Session: string | null;
  AuthenticationResult: {} | undefined;
}

export type Output =
  | SmsMfaOutput
  | PasswordVerifierOutput
  | NewPasswordRequiredOutput;

export type InitiateAuthTarget = (body: Input) => Promise<Output>;

const verifyMfaChallenge = async (
  user: User,
  body: Input,
  userPool: UserPoolClient,
  codeDelivery: CodeDelivery
): Promise<SmsMfaOutput> => {
  if (!user.MFAOptions?.length) {
    throw new NotAuthorizedError();
  }
  const smsMfaOption = user.MFAOptions?.find((x) => x.DeliveryMedium === "SMS");
  if (!smsMfaOption) {
    throw new UnsupportedError("MFA challenge without SMS");
  }

  const deliveryDestination = attributeValue(
    smsMfaOption.AttributeName,
    user.Attributes
  );
  if (!deliveryDestination) {
    throw new UnsupportedError(`SMS_MFA without ${smsMfaOption.AttributeName}`);
  }

  const code = await codeDelivery(user, {
    ...smsMfaOption,
    Destination: deliveryDestination,
  });

  await userPool.saveUser({
    ...user,
    MFACode: code,
  });

  return {
    ChallengeName: "SMS_MFA",
    ChallengeParameters: {
      CODE_DELIVERY_DELIVERY_MEDIUM: "SMS",
      CODE_DELIVERY_DESTINATION: deliveryDestination,
      USER_ID_FOR_SRP: user.Username,
    },
    Session: body.Session,
  };
};

const verifyPasswordChallenge = async (
  user: User,
  body: Input,
  userPool: UserPoolClient
): Promise<PasswordVerifierOutput> => ({
  ChallengeName: "PASSWORD_VERIFIER",
  ChallengeParameters: {},
  AuthenticationResult: await generateTokens(
    user,
    body.ClientId,
    userPool.config.Id
  ),
  Session: body.Session,
});

function newPasswordChallenge(
  user: User,
  body: Input
): NewPasswordRequiredOutput {
  return {
    ChallengeName: "NEW_PASSWORD_REQUIRED",
    ChallengeParameters: {
      USER_ID_FOR_SRP: user.Username,
      requiredAttributes: "[]",
      userAttributes: JSON.stringify({
        email_verified: true,
        email: user.Attributes.filter((a) => a.Name === "email")[0],
      }),
    },
    AuthenticationResult: undefined,
    Session: body.Session,
  };
}

export const InitiateAuth = ({
  codeDelivery,
  cognitoClient,
  triggers,
}: Services): InitiateAuthTarget => async (body) => {
  if (body.AuthFlow !== "USER_PASSWORD_AUTH") {
    throw new UnsupportedError(`AuthFlow=${body.AuthFlow}`);
  }

  const userPool = await cognitoClient.getUserPoolForClientId(body.ClientId);
  let user = await userPool.getUserByUsername(body.AuthParameters.USERNAME);

  if (!user && triggers.enabled("UserMigration")) {
    // https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-migrate-user.html
    //
    // Amazon Cognito invokes [the User Migration] trigger when a user does not exist in the user pool at the time of
    // sign-in with a password, or in the forgot-password flow. After the Lambda function returns successfully, Amazon
    // Cognito creates the user in the user pool.
    user = await triggers.userMigration({
      userPoolId: userPool.config.Id,
      clientId: body.ClientId,
      username: body.AuthParameters.USERNAME,
      password: body.AuthParameters.PASSWORD,
      userAttributes: [],
    });
  }

  if (!user || user.Password !== body.AuthParameters.PASSWORD) {
    throw new InvalidUsernameOrPasswordError();
  }

  if (user.UserStatus === "FORCE_CHANGE_PASSWORD") {
    body.Session = "xxx --- FIX THIS --- xxx";
    return newPasswordChallenge(user, body);
  }

  if (user.UserStatus === "RESET_REQUIRED") {
    throw new PasswordResetRequiredError();
  }

  if (
    (userPool.config.MfaConfiguration === "OPTIONAL" &&
      (user.MFAOptions ?? []).length > 0) ||
    userPool.config.MfaConfiguration === "ON"
  ) {
    return verifyMfaChallenge(user, body, userPool, codeDelivery);
  }

  const result = await verifyPasswordChallenge(user, body, userPool);

  if (triggers.enabled("PostAuthentication")) {
    await triggers.postAuthentication({
      source: "PostAuthentication_Authentication",
      username: user.Username,
      clientId: body.ClientId,
      userPoolId: userPool.config.Id,
      userAttributes: user.Attributes,
    });
  }

  return result;
};
