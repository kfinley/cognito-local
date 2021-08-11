import { Lambda } from "../lambda";
import { UserPoolClient } from "../userPoolClient";
import {
  PostAuthentication,
  PostAuthenticationTrigger,
} from "./postAuthentication";
import { CognitoClient } from "../cognitoClient";

describe("PostAuthentication trigger", () => {
  let mockLambda: jest.Mocked<Lambda>;
  let mockCognitoClient: jest.Mocked<CognitoClient>;
  let mockUserPoolClient: jest.Mocked<UserPoolClient>;
  let postAuthentication: PostAuthenticationTrigger;

  beforeEach(() => {
    mockLambda = {
      enabled: jest.fn(),
      invoke: jest.fn(),
    };
    mockUserPoolClient = {
      config: {
        Id: "test",
      },
      createAppClient: jest.fn(),
      getUserByUsername: jest.fn(),
      listUsers: jest.fn(),
      saveUser: jest.fn(),
    };
    mockCognitoClient = {
      getUserPool: jest.fn().mockResolvedValue(mockUserPoolClient),
      getUserPoolForClientId: jest.fn().mockResolvedValue(mockUserPoolClient),
    };
    postAuthentication = PostAuthentication({
      lambda: mockLambda,
      cognitoClient: mockCognitoClient,
    });
  });

  describe.each(["PostAuthentication_Authentication"])("%s", (source) => {
    describe("when lambda invoke fails", () => {
      it("quietly completes", async () => {
        mockLambda.invoke.mockRejectedValue(
          new Error("Something bad happened")
        );

        await postAuthentication({
          userPoolId: "userPoolId",
          clientId: "clientId",
          username: "username",
          userAttributes: [],
          source: source as any,
        });
      });
    });

    describe("when lambda invoke succeeds", () => {
      it("quietly completes", async () => {
        mockLambda.invoke.mockResolvedValue({});

        await postAuthentication({
          userPoolId: "userPoolId",
          clientId: "clientId",
          username: "example@example.com",
          userAttributes: [{ Name: "email", Value: "example@example.com" }],
          source: source as any,
        });

        expect(mockLambda.invoke).toHaveBeenCalledWith("PostAuthentication", {
          clientId: "clientId",
          triggerSource: source,
          userAttributes: { email: "example@example.com" },
          userPoolId: "userPoolId",
          username: "example@example.com",
        });
      });
    });
  });
});
