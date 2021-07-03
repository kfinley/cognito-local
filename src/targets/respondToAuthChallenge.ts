import { CodeMismatchError, InvalidUsernameOrPasswordError } from "../errors";
import { Services } from "../services";
import { generateTokens } from "../services/tokens";

interface Input {
  ChallengeName: "SMS_MFA" | "NEW_PASSWORD_REQUIRED";
  ChallengeResponses: {
    USERNAME: string;
    NEW_PASSWORD?: string | null;
    SMS_MFA_CODE: string | null;
  };
  ClientId: string;
  Session: string | null;
}

interface Output {
  ChallengeName: string;
  ChallengeParameters: {};
  AuthenticationResult: {
    IdToken: string;
    AccessToken: string;
    RefreshToken: string;
  };
  Session: string | null;
}

export type RespondToAuthChallengeTarget = (body: Input) => Promise<Output>;

export const RespondToAuthChallenge = ({
  cognitoClient,
}: Services): RespondToAuthChallengeTarget => async (body) => {
  const userPool = await cognitoClient.getUserPoolForClientId(body.ClientId);
  const user = await userPool.getUserByUsername(
    body.ChallengeResponses.USERNAME
  );
  if (!user) {
    throw new InvalidUsernameOrPasswordError();
  }

  if (user.MFACode !== body.ChallengeResponses.SMS_MFA_CODE) {
    throw new CodeMismatchError();
  }

  if (body.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    user.Password = body.ChallengeResponses.NEW_PASSWORD as string;
    user.UserStatus = "CONFIRMED";
  }

  await userPool.saveUser({
    ...user,
    MFACode: undefined,
  });

  return {
    ChallengeName: body.ChallengeName,
    ChallengeParameters: {},
    AuthenticationResult: await generateTokens(
      user,
      body.ClientId,
      userPool.config.Id
    ),
    Session: body.Session,
  };
};
