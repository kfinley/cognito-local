import { ResourceNotFoundError } from "../../errors";
import { CognitoClient } from "../index";
import { Lambda } from "../lambda";
import { attributesToRecord, UserAttribute } from "../userPoolClient";

export type PostAuthenticationTrigger = (params: {
  source: "PostAuthentication_Authentication";
  userPoolId: string;
  clientId: string;
  username: string;
  userAttributes: readonly UserAttribute[];
}) => Promise<void>;

export const PostAuthentication = ({
  lambda,
  cognitoClient,
}: {
  lambda: Lambda;
  cognitoClient: CognitoClient;
}): PostAuthenticationTrigger => async ({
  source,
  userPoolId,
  clientId,
  username,
  userAttributes,
}): Promise<void> => {
  try {
    const userPool = await cognitoClient.getUserPoolForClientId(clientId);
    if (!userPool) {
      throw new ResourceNotFoundError();
    }

    await lambda.invoke("PostAuthentication", {
      userPoolId,
      clientId,
      username,
      userAttributes: attributesToRecord(userAttributes),
      triggerSource: source,
    });
  } catch (ex) {
    console.error(ex);
  }
};
