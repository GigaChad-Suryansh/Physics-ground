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

## 3. Run the first test
1. Open **Actions → Physics Playground Autonomous Developer**.
2. Select **Run workflow**.
3. Review the logs and the pull request it proposes.
4. Check the test/build results and inspect every diff before merging.

The workflow is scheduled daily at 08:00 India Standard Time. It proposes changes through a pull request; it does not merge the PR or deploy it itself. Your existing Pages workflow deploys after a change reaches the configured deployment branch.

## Important
The starter's initial roadmap records the 100 planned concepts, but it does not certify that all existing simulations are bug-free. The first run must audit the actual code and existing tests before implementing any new concept.
