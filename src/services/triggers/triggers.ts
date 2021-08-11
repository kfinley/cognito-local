import { CognitoClient } from "../index";
import { Lambda } from "../lambda";
import {
  PostAuthentication,
  PostAuthenticationTrigger,
} from "./postAuthentication";
import { PostConfirmation, PostConfirmationTrigger } from "./postConfirmation";
import { UserMigration, UserMigrationTrigger } from "./userMigration";

export interface Triggers {
  enabled(
    trigger: "UserMigration" | "PostConfirmation" | "PostAuthentication"
  ): boolean;
  userMigration: UserMigrationTrigger;
  postConfirmation: PostConfirmationTrigger;
  postAuthentication: PostAuthenticationTrigger;
}

export const createTriggers = (services: {
  lambda: Lambda;
  cognitoClient: CognitoClient;
}): Triggers => ({
  enabled: (trigger: "UserMigration") => services.lambda.enabled(trigger),
  userMigration: UserMigration(services),
  postConfirmation: PostConfirmation(services),
  postAuthentication: PostAuthentication(services),
});
