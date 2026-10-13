# Enable the Gemini autonomous developer

The workflow is committed in `.github/workflows/physics-playground-agent.yml`, but it will not call Gemini until you add a repository secret.

## 1. Create a Gemini API key
1. Open [Google AI Studio](https://aistudio.google.com/apikey).
2. Create an API key for the Gemini API.
3. Check the current [Gemini API pricing and free-tier limits](https://ai.google.dev/gemini-api/docs/pricing). Free access depends on the selected model, region, and quotas; it is not an unlimited guarantee.

## 2. Add the key to GitHub
1. Open this repository: [Physics-ground](https://github.com/GigaChad-Suryansh/Physics-ground).
2. Go to **Settings → Secrets and variables → Actions**.
3. Select **New repository secret**.
4. Name it exactly `GEMINI_API_KEY`.
5. Paste the key as the value and save it.

Never put the key in source files, website JavaScript, commits, or screenshots.

## 3. Allow the workflow to open pull requests (one time)
GitHub blocks Actions from creating pull requests by default. Without this the run ends with
`GitHub Actions is not permitted to create or approve pull requests`.

1. **Settings → Actions → General**.
2. Scroll to **Workflow permissions**.
3. Tick **Allow GitHub Actions to create and approve pull requests** and **Save**.

(Alternative: create a fine-grained personal access token with *Contents* and *Pull requests* write access for this repo and store it as the secret `PR_TOKEN`; the workflow uses it automatically.)

## 4. Run the first test
1. Open **Actions → Physics Playground Autonomous Developer**.
2. Select **Run workflow**.
3. Review the logs and the pull request it proposes.
4. Check the test/build results and inspect every diff before merging.

### What the run does
1. Builds and tests the site (baseline).
2. **Select a working Gemini model** — checks the key and tries free-tier models from best to worst, so a quota problem fails in seconds with a clear table in the run summary instead of a 90-second mystery failure. Pin a model with the repository *variable* `GEMINI_MODEL` (Settings → Secrets and variables → Actions → **Variables**).
3. **Prepare agent brief** — picks the next roadmap concept and lists the existing files, so the agent spends its turns building, not exploring.
4. Runs Gemini; if it fails it retries once with the next working model.
5. Reverts any agent edits to `.github/`, `scripts/` and `GEMINI.md`, appends the daily log, re-runs tests and build, and opens/updates the pull request.

### If a run fails
Open the run and read the **Summary** tab first:
- *Gemini API key was rejected* → create a new key and update the `GEMINI_API_KEY` secret.
- *Gemini free quota exhausted* → every free model is out of quota; it resets daily and the next run tries again.
- *Pull request could not be created* → step 3 above. The work is already on the branch `automation/physics-playground-daily`.

You can test changes to the workflow before merging: **Actions → Run workflow → choose the branch**.

The workflow is scheduled daily at 08:00 India Standard Time. It proposes changes through a pull request; it does not merge the PR or deploy it itself. Your existing Pages workflow deploys after a change reaches the configured deployment branch.

## Important
The starter's initial roadmap records the 100 planned concepts, but it does not certify that all existing simulations are bug-free. The first run must audit the actual code and existing tests before implementing any new concept.
