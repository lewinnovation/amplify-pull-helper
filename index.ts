import { ListRegionsCommandOutput } from "@aws-sdk/client-account";
import {
  ListAppsCommandOutput,
  ListBranchesCommandOutput,
} from "@aws-sdk/client-amplify";
import { select } from "@inquirer/prompts";
import { type as osType } from "node:os";
import colors from "yoctocolors";
import { $, usePowerShell } from "zx";

if (osType() === "Windows_NT") {
  usePowerShell();
}

const awsProfiles: string[] = (await $`aws configure list-profiles`).lines();
const selectedAwsProfile = await select({
  message: "Please select the AWS profile to use",
  choices: awsProfiles.map((x) => ({ name: x, value: x })),
});

const awsRegions: ListRegionsCommandOutput = (
  await $`aws --profile ${selectedAwsProfile} account list-regions --output json`
).json();

const selectedAwsRegion = await select({
  message: "Please select the AWS region to use",
  choices:
    awsRegions.Regions?.filter(
      (x) =>
        x.RegionOptStatus === "ENABLED" ||
        x.RegionOptStatus === "ENABLED_BY_DEFAULT",
    )?.map((x) => ({ name: x.RegionName, value: x.RegionName })) ?? [],
});

if (!selectedAwsRegion) {
  console.error("No AWS region selected");
  process.exit(1);
}

const amplifyApps: ListAppsCommandOutput = (
  await $`aws --profile ${selectedAwsProfile} --region ${selectedAwsRegion} amplify list-apps --output json`
).json();

if (!amplifyApps.apps?.length) {
  console.error("No Amplify apps found in the selected region");
  process.exit(1);
}

const selectedAmplifyApp = await select({
  message: "Please select the Amplify app to use",
  choices: amplifyApps.apps.map((x) => ({
    name: x.name ?? "Unknown App",
    value: x,
  })),
});

if (!selectedAmplifyApp.appId) {
  console.error(
    `Selected amplify app does not have an App ID. Dunno wtf is going on there`,
  );
  process.exit(1);
}

const amplifyBranches: ListBranchesCommandOutput = (
  await $`aws --profile ${selectedAwsProfile} --region ${selectedAwsRegion} amplify list-branches --app-id ${selectedAmplifyApp.appId} --output json`
).json();

if (!amplifyBranches.branches?.length) {
  console.error(
    `No branches found for Amplify app ${selectedAmplifyApp.name} in region ${selectedAwsRegion}`,
  );
  process.exit(1);
}

const selectedAmplifyBranch = await select({
  message: "Please select the Amplify branch to use",
  choices:
    amplifyBranches.branches?.map((x) => ({
      name: x.branchName ?? "Unknown Branch",
      value: x,
    })) ?? [],
});

if (!selectedAmplifyBranch.branchName) {
  console.error(
    `Selected Amplify branch does not have a branch name. Dunno wtf is going on there`,
  );
  process.exit(1);
}

console.log(
  `Generating outputs for ${colors.bold(selectedAmplifyBranch.branchName)} branch of ${colors.bold(selectedAmplifyApp.name ?? "")} app in ${colors.bold(selectedAwsRegion)} region using ${colors.bold(selectedAwsProfile)} profile.`,
);

await $`pnpm exec ampx --profile ${selectedAwsProfile} --region ${selectedAwsRegion} generate outputs --app-id ${selectedAmplifyApp.appId} --branch ${selectedAmplifyBranch.branchName}`;
