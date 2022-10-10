import * as core from '@actions/core';
import * as github from '@actions/github';
import { execSync } from 'child_process';
import { Octokit } from '@octokit/action';

let baseSha, headSha: string;

(async () => {
  try {
    console.log(`Starting..`);

    // Get the JSON webhook payload for the event that triggered the workflow
    const payload = JSON.stringify(github.context.payload, undefined, 2)
    console.log(`The event payload: ${payload}`);

    // 1. Make sure a tag triggered this github action
    if (!isGithubActionTriggeredByTag()) {
      core.setFailed('Only works for tag triggers');
      return;
    }

    // 2. Set the head sha
    headSha = execSync(`git rev-parse HEAD`, { encoding: 'utf-8' });
    core.setOutput('head_sha', headSha);

    // 3. Was a base provided, if so, set the base sha
    const base = core.getInput('base_tag');
    if (base) {
      console.log('Setting the base sha as a "base" argument was given');
      baseSha = execSync(`git rev-parse ${base}`, { encoding: 'utf-8' });
    }

    // 4. Get the latest successful workflow's commit
    if (!baseSha) {
      console.log('Setting the base sha as the sha of the latest workflow that was successful');
      baseSha = await getLastSuccessfulWorkflowCommitSha();
    }

    // 4.1 Fall back to getting the very first commit
    if (!baseSha) {
      console.log('Setting the base sha as the very first commit sha');
      baseSha = execSync('git rev-list --max-parents=0 HEAD', { encoding: 'utf8' });
    }

    // 4.2 If for some reason we could not find any base at this point, we fail the action and exit
    if (!baseSha) {
      console.log('Could not find a sha as the base sha');
      core.setFailed('Could not find a base sha');
      return;
    }

    core.setOutput('base_sha', baseSha);

    console.log('Base sha is: ', baseSha);
    console.log('Head sha is: ', headSha);
    console.log(`Finished.`);
  } catch (error) {
    core.setFailed(error.message);
  }
})();

/**
 * Check if current workflow was triggered by a tag
 * @returns {boolean}
 */
const isGithubActionTriggeredByTag = (): boolean => {
  return process.env.GITHUB_REF_TYPE === 'tag';
};

/**
 * Get the filename of the current workflow being ran
 * @returns {string}
 */
const getWorkflowName = (): string => {
  const { workflow } = github.context;
  return workflow.split('/').pop();
}

/**
 * Check if a given commit is an exact match with any tag
 * @param {string} commitSha
 * @returns {boolean}
 */
 const isCommitTag = (commitSha: string) => {
  try {
    execSync(`git describe --tags --exact-match ${commitSha}`);
    return true;
  } catch (error) {
    console.log("Commit is not a tag", commitSha, error);
    return false;
  }
}

/**
 * Get latest existing commit that is a tag from a reverse-chronologival commits shas list
 * @param {string[]} commitShas
 * @returns {string?}
 */
 const findFirstExistingTagCommit = (commitShas: Array<string>): string | undefined => {
  for (const commitSha of commitShas) {
    if (isCommitTag(commitSha)) {
      return commitSha;
    }
  }

  return undefined;
}

/**
 * Get last successful workflow's commit sha
 * @returns {string}
 */
const getLastSuccessfulWorkflowCommitSha = async () => {
  const octokit = new Octokit();
  const { repo: { repo, owner }, eventName } = github.context;
  const workflowId = getWorkflowName();

  // fetch all workflow runs on a given repo/branch/workflow with push and success
  let shasOfSuccessfullWorkflows = await octokit.request(`GET /repos/${owner}/${repo}/actions/workflows/${workflowId}/runs`, {
    owner,
    repo,
    workflowId,
    event: eventName,
    status: 'success'
  }).then(({ data: { workflow_runs } }) => workflow_runs.map(run => run.head_sha));

  return await findFirstExistingTagCommit(shasOfSuccessfullWorkflows);
};
