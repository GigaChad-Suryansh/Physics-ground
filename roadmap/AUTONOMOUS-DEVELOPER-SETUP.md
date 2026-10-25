# Enable the NVIDIA NIM autonomous developer

The workflow is committed in `.github/workflows/physics-playground-agent.yml`, but it will not call NVIDIA NIM until you add a repository secret.

## 1. Create an NVIDIA API key
1. Open the [NVIDIA API Catalog](https://build.nvidia.com/).
2. Generate an API key for hosted NVIDIA NIM endpoints.
3. Check the selected model's current usage limits and availability in the NVIDIA API Catalog; limits may vary by model and account.

## 2. Add the key to GitHub
1. Open this repository: [Physics-ground](https://github.com/GigaChad-Suryansh/Physics-ground).
2. Go to **Settings → Secrets and variables → Actions**.
3. Select **New repository secret**.
4. Name it exactly `NVIDIA_API_KEY`.
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
- *NVIDIA NIM request failed (401/403)* → check your NVIDIA API key and update the `NVIDIA_API_KEY` secret.
- *NVIDIA NIM returned HTTP 429* → the model/account rate limit or quota may be exhausted; check the NVIDIA API Catalog usage details.
- *Pull request could not be created* → step 3 above. The work is already on the branch `automation/physics-playground-daily`.

You can test changes to the workflow before merging: **Actions → Run workflow → choose the branch**.

The workflow is scheduled daily at 08:00 India Standard Time. It proposes changes through a pull request; it does not merge the PR or deploy it itself. Your existing Pages workflow deploys after a change reaches the configured deployment branch.

## Important
The starter's initial roadmap records the 100 planned concepts, but it does not certify that all existing simulations are bug-free. The first run must audit the actual code and existing tests before implementing any new concept.

## How a run is verified (never trust the agent)

The workflow does not take Gemini's word that it succeeded. After the agent runs:

1. `scripts/verify.mjs` runs roadmap validation, `npm run build` (tsc + vite) and `npm test` itself, and rejects any "concept completed" claim that has no new page, physics module and route.
2. If that fails, Gemini gets **one** repair pass with the real compiler/test errors.
3. If the final verification still fails, `scripts/discard-agent-work.mjs` throws the changes away, records the failure in `roadmap/progress.json` (3 failures on one concept blocks it), and only the daily log is committed. Broken code is never put in a pull request.

If NVIDIA NIM keeps failing, open `roadmap/daily-log.md` on the `automation/physics-playground-daily` branch: it records Gemini's actual error text.
