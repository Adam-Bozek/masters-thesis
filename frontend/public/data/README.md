# Testing Questions JSON – README

This document describes the JSON configuration used to drive the multi-phase testing flow in the app.

## File structure

The configuration file is a JSON array of **Question** objects:

```json
[{ "questionId": 1, "questionType": 1, "questionText": "...", "questionAudioPath": "...", "acceptedTranscripts": ["..."], "answers": [] }]
```

## Naming conventions

Use these exact field names (fixed spelling):

- `questionId`
- `questionType`

## Shared fields (all question types)

| Field                 |     Type | Required | Used in types | Description                                                              |
| --------------------- | -------: | :------: | ------------- | ------------------------------------------------------------------------ |
| `questionId`          |   number |   yes    | 1,2,3,4       | Unique identifier of the question within the file. Typically sequential. |
| `questionType`        |   number |   yes    | 1,2,3,4       | Determines which schema variant is used (1, 2, 3, 4).                    |
| `questionText`        |   string |   yes    | 1,2,3,4       | Primary question shown to the user.                                      |
| `questionAudioPath`   |   string |   yes    | 1,2,3,4       | Path to an audio file (mp3) where a human reads `questionText`.          |
| `acceptedTranscripts` | string[] |  yes\*   | 1,2,3,4       | Allowed user answer transcripts (speech-to-text outputs).                |
| `answers`             | Answer[] |   yes    | 1,2           | Image answers for multiple-choice questions.                             |
| `config`              |   object |   yes    | 3             | SceneBuilder configuration.                                              |
| `imagePath`           |   string |   yes    | 4             | Single image to describe (no multiple-choice).                           |

\* `acceptedTranscripts` is required by the current examples. If you later support purely visual selection (no speech), you can make this optional in your validator for types 1/2.

### Transcript normalization guidance

When evaluating `acceptedTranscripts`, normalize user input consistently (recommended):

- trim whitespace
- lowercase
- optionally remove diacritics (e.g., `ananás` → `ananas`) if your STT often drops accents

Store both accented and unaccented variants when relevant.

---

## Answer object (used by question types 1 and 2)

```json
{
  "answerId": 1,
  "isCorrect": true,
  "label": "Ananás",
  "imagePath": "/images/testing/marketplace/1-1.jpg"
}
```

| Field       |    Type | Required | Description                                                     |
| ----------- | ------: | :------: | --------------------------------------------------------------- |
| `answerId`  |  number |   yes    | Unique identifier within the `answers` array.                   |
| `isCorrect` | boolean |   yes    | Marks whether this answer is the correct one.                   |
| `label`     |  string |   yes    | Short label for analytics/debugging (can be shown in admin UI). |
| `imagePath` |  string |   yes    | Image or GIF path displayed as the option.                      |

**Recommended constraints**

- Exactly **one** `answers[i].isCorrect === true` per question.
- `answers.length` should be stable per task (commonly 2–6).

---

## Question type 1 – Single question, single audio (multiple-choice)

### Schema

```json
{
  "questionId": 1,
  "questionType": 1,
  "questionText": "",
  "questionAudioPath": "",
  "acceptedTranscripts": ["", ""],
  "answers": [{ "answerId": 1, "isCorrect": true, "label": "", "imagePath": "" }]
}
```

### Example

```json
{
  "questionId": 1,
  "questionType": 1,
  "questionText": "Na ktorom obrázku je ananás?",
  "questionAudioPath": "/sounds/testing/marketplace/1.mp3",
  "acceptedTranscripts": ["ananás", "ananas", "nanas", "na-nás", "na nas", "anáš", "ananá", "anan", "nana", "nanas"],
  "answers": [
    { "answerId": 1, "isCorrect": true, "label": "Ananás", "imagePath": "/images/testing/marketplace/1-1.jpg" },
    { "answerId": 2, "isCorrect": false, "label": "Kiwi", "imagePath": "/images/testing/marketplace/1-2.jpg" },
    { "answerId": 3, "isCorrect": false, "label": "Mango", "imagePath": "/images/testing/marketplace/1-3.jpg" },
    { "answerId": 4, "isCorrect": false, "label": "Avokado", "imagePath": "/images/testing/marketplace/1-4.jpg" },
    { "answerId": 5, "isCorrect": false, "label": "Citrón", "imagePath": "/images/testing/marketplace/1-5.jpg" },
    { "answerId": 6, "isCorrect": false, "label": "Jablko", "imagePath": "/images/testing/marketplace/1-6.jpg" }
  ]
}
```

---

## Question type 2 – Two linked questions + two audio files (multiple-choice)

Type 2 is the same as type 1, but it contains a **second** prompt and audio file for follow-up questioning.

### Schema

```json
{
  "questionId": 1,
  "questionType": 2,
  "questionText": "",
  "questionText2": "",
  "questionAudioPath": "",
  "questionAudioPath2": "",
  "acceptedTranscripts": ["", ""],
  "answers": [{ "answerId": 1, "isCorrect": true, "label": "", "imagePath": "" }]
}
```

| Additional field     |   Type | Required | Description                                               |
| -------------------- | -----: | :------: | --------------------------------------------------------- |
| `questionText2`      | string |   yes    | Second question displayed after (or alongside) the first. |
| `questionAudioPath2` | string |   yes    | Audio file for `questionText2`.                           |

### Example

```json
{
  "questionId": 13,
  "questionType": 2,
  "questionText": "Na ktorom obrázku ujo čaká na autobusovej zastávke?",
  "questionText2": "Čo robí ujo na autobusovej zastávke?",
  "questionAudioPath": "/sounds/testing/marketplace/13-1.mp3",
  "questionAudioPath2": "/sounds/testing/marketplace/13-2.mp3",
  "acceptedTranscripts": ["ujo čaká", "ujo caka", "ujo vyčkáva"],
  "answers": [
    { "answerId": 1, "isCorrect": true, "label": "Ujo čaká", "imagePath": "/images/testing/marketplace/13-1.gif" },
    { "answerId": 2, "isCorrect": false, "label": "Ujo ide", "imagePath": "/images/testing/marketplace/13-2.gif" }
  ]
}
```

---

## Question type 3 – Story / listening comprehension + SceneBuilder config

Type 3 is not multiple-choice. Instead of `answers`, it provides `config` for the SceneBuilder component.

### Base schema

```json
{
  "questionId": 1,
  "questionType": 3,
  "questionText": "",
  "questionAudioPath": "",
  "acceptedTranscripts": ["", ""],
  "config": {}
}
```

### `config` options

`config` supports two shapes:

#### Option A: Multi-picture scene timeline

```json
{
  "sound_path": "/sounds/testing/zoo/scene.mp3",
  "pictures": [
    { "path": "/images/1.jpg", "display_time": "0:00", "display_type": "insert" },
    { "path": "/images/2.jpg", "display_time": "0:26", "display_type": "add" },
    { "path": "/images/3.jpg", "display_time": "1:00", "display_type": "remove_all_and_add" }
  ]
}
```

**Picture entry fields**

| Field          |   Type | Required | Description                                                                                  |
| -------------- | -----: | :------: | -------------------------------------------------------------------------------------------- |
| `path`         | string |   yes    | Image to display.                                                                            |
| `display_time` | string |   yes    | When to apply the change in the audio timeline. Format: `M:SS` or `H:MM:SS` (be consistent). |
| `display_type` | string |   yes    | How the scene changes at `display_time`. See enum below.                                     |

**`display_type` enum** (string)

- `insert` – start scene with exactly this picture (or replace initial state)
- `add` – add this picture to existing scene
- `remove` – remove this picture from existing scene (match by `path`)
- `remove_all_and_add` – clear scene and then add this picture

#### Option B: Single picture scene

```json
{
  "picture_path": "/images/testing/zoo/story.jpg",
  "sound_path": "/sounds/testing/zoo/story.mp3"
}
```

### Full example (Option A)

```json
{
  "questionId": 1,
  "questionType": 3,
  "questionText": "",
  "questionAudioPath": "",
  "acceptedTranscripts": ["", ""],
  "config": {
    "sound_path": "/sounds/testing/zoo/scene.mp3",
    "pictures": [
      { "path": "/images/1.jpg", "display_time": "0:00", "display_type": "insert" },
      { "path": "/images/2.jpg", "display_time": "0:26", "display_type": "add" },
      { "path": "/images/3.jpg", "display_time": "1:00", "display_type": "remove_all_and_add" }
    ]
  }
}
```

---

## Question type 4 – Single image + “describe what you see” (open answer)

Type 4 shows **one** image (not multiple-choice). The user answers by speaking/typing what they see.
Your runtime compares the transcript to `acceptedTranscripts`.

### Schema

```json
{
  "questionId": 16,
  "questionType": 4,
  "questionText": "",
  "questionAudioPath": "",
  "imagePath": "",
  "acceptedTranscripts": ["", ""]
}
```

### Example

```json
{
  "questionId": 16,
  "questionType": 4,
  "questionText": "Čo vidíš na tomto obrázku?",
  "questionAudioPath": "/sounds/testing/marketplace/16.mp3",
  "imagePath": "/images/testing/marketplace/16.jpg",
  "acceptedTranscripts": ["autíčka", "auticka", "viac autíčiek", "viac auticiek", "veľa áut", "vela aut", "autá", "auta"]
}
```

**Recommended constraints**

- Do not include `answers` or `config` in type 4.
- `imagePath` must be present and point to a single image file.
