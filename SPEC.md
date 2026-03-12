# gityo CLI

## Overview

gityo is a CLI tool that helps developers stage and commit their changes in a more interactive way. It provides a simple interface to review changes, select which files to stage, and generate commit messages based on the staged changes.

## Features

- has json config file for customization
  - models: a record of models to generate commit messages from
    - Key `openai` | `anthropic` | `openrouter` | `kilo` | custom base url
    - Value: array of model names
  - default model: the default model to use for generating commit messages
  - postCommand: `push` | `push-and-pull`
  - autoRunPostCommand: boolean to determine if the post command should be run automatically after committing or if the user should be prompted to run it.
- Secure api key.. api key wont be saved in the config. when using that model the user will be prompted to enter then api key.. then it will be saved in a safe place.. and then it will be used later.. also using `gityo models` user can update the api keys (eg: `eg: gityo models set openai sk-xxxx`, or `eg: gityo models set https://custom-base-url sk-xxxx`) or just using `gityo models set` will open the interactive prompt to update the keys. `gityo models list` will list the models with the associated keys (masking the keys for security)

## Flow

### 0. Run

```
gityo
```

### 1. Show Status (Stage Step)

```
branch: feature/auth

changes:
[ ] auth.js
[ ] userService.js
[ ] middleware/authGuard.js
```

#### Stage Files

User navigates the list. Keys:

```
↑ ↓   move
space select / deselect
enter confirm
```

Example:

```
branch: feature/auth

changes
[x] auth.js
[x] userService.js
[ ] middleware/authGuard.js
```

If **enter** is pressed with nothing selected → all files are staged.

### 2. Generate Commit & Commit (Commit Step)

The tool generates a commit message from the staged diff using a model (Pressing tab will change model)

```
feat(auth): add auth guard middleware
```

User confirms:

```
commit? (y/n/enter)
> y
```

Then runs:

```
git commit -m "<message>"
```

---

### 3. Post Command

Configurable from the config file. By default, it is git push

```
git push
```

## Test

- create a docker env to test this things reliablity.. no need for auth just if things are working correcly.. maybe you can fake git commands just to ttest the cli
