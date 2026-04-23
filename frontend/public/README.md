# Public assets

This folder contains runtime assets required by the frontend application.

## Important notice

The full contents of `frontend/public/` are **not included in the public GitHub repository**.

That means a fresh clone of the public repository may be missing files required by the testing flows, including:

- testing images
- testing audio files

Without these assets, parts of the application will not work correctly. Missing files will cause:

- category screens to load without images
- audio prompts to fail
- scene-based tasks to break
- demo mode or guest mode to behave incorrectly
- question configuration lookups to fail

## What this folder is expected to contain

```text
public/
├── data/
│   ├── demo/
│   │   ├── questions.json
│   │   └── scenes.json
│   ├── home.json
│   ├── marketplace.json
│   ├── mountains.json
│   ├── parent_answers.json
│   ├── scene_config.json
│   ├── street.json
│   └── zoo.json
├── images/
│   ├── 1.jpg
│   ├── 2.jpg
│   ├── 3.jpg
│   └── testing/
│       ├── home/
│       ├── marketplace/
│       ├── mountains/
│       ├── street/
│       └── zoo/
└── sounds/
    ├── 1.mp3
    ├── 2.mp3
    └── testing/
        ├── home/
        ├── marketplace/
        ├── mountains/
        ├── street/
        └── zoo/
```

The application expects these files to keep the same relative paths, because the JSON configuration references them directly.

## Setup

To run the frontend with full functionality:

1. Obtain the `public/` asset package from the project author or repository owner.
2. Extract or copy the files into `frontend/public/`.
3. Preserve the directory structure exactly.
4. Start the frontend only after the assets are in place.

## Additional notes

- The JSON schema used by files in `public/data/` is documented in `public/data/README.md`.
- Asset paths in the JSON configuration are resolved from the frontend `public/` directory.
- If you replace files, keep filenames and paths aligned with the JSON references.
