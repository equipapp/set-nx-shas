# Set NX Shas
It sets the NX shas for use with the `nx affected` command and a CI pipeline based on git tags.
For the head sha, it just takes the sha of the git tag that's being pushed.
For the base sha, it looks for the last successful workflow in the current workflow, make sure it's a tag and grabs its corresponding sha. If none are found, like in the very first push picked up by your CI pipeline, it will take the very first commit ever made, effectively looking at the entire code base and the tag being pushed.

## Development
### Local
#### Deps
- node 16.17.1
