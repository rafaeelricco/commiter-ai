# Commiter AI for VS Code

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/r1cco.commiter-ai-generator.svg?label=VS%20Code%20Marketplace&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=r1cco.commiter-ai-generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Commiter AI is a powerful VS Code extension that automatically generates intelligent and meaningful commit messages with AI. It streamlines your Git workflow by analyzing your code changes and creating appropriate commit messages in various styles.

<!-- <p align="center">
  <img src="https://raw.githubusercontent.com/rafaeelricco/commiter-ai/main/src/assets/sparkle-dark.png" width="150" alt="Commiter AI Logo">
</p> -->

## Features

### AI-Powered Commit Message Generation

- Analyze your staged changes and generate contextually appropriate commit messages
- Support for both staged and unstaged changes
- Automatic detection of the type of changes made (feature, fix, refactor, etc.)
- Clean, concise, and properly formatted commit messages

### Multiple Commit Styles

Commiter AI supports various commit message styles to match your project's conventions:

- **Conventional Commits**: `feat: add login validation`
- **Linus Style**: Title followed by detailed explanation
- **Imperative Mood**: `implement password strength check`
- **Simple Prefix**: `fix: header alignment issue`
- **Contextual**: `[auth] update session timeout`
- **Ticket Reference**: `PROJ-123: add user dashboard`
- **Symbol Notation**: `[+] enable dark mode toggle`
- **Concise**: `optimize image loading`

### Customizable Settings

- Choose your preferred AI model from OpenRouter's offerings
- Adjust creativity level via temperature setting
- Customize token limits for response length
- Define your own prompting instructions
- Enable/disable sound feedback

## Getting Started

### Prerequisites

- Visual Studio Code 1.48.0 or newer
- Git installed and configured
- OpenRouter API key (get one from [OpenRouter.ai](https://openrouter.ai/keys))

### Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Commiter AI"
4. Click Install

### Configuration

1. Open VS Code settings (Ctrl+,)
2. Search for "Commiter AI"
3. Enter your OpenRouter API key
4. Customize other settings as needed:
   - AI Model
   - Commit Style
   - Creativity level
   - Max tokens
   - Custom prompt

## Usage

1. Make changes to your files
2. Stage your changes with Git
3. Click the Commiter AI icon in the Source Control panel (or run the "Generate Commit" command)
4. Your commit message will be automatically generated and inserted into the commit message field
5. Review and adjust if needed, then commit as normal

## Extension Settings

| Setting                            | Description                                        | Default                                |
| ---------------------------------- | -------------------------------------------------- | -------------------------------------- |
| `commiter_ai.api_key`              | OpenRouter API key for accessing AI services       | `null`                                 |
| `commiter_ai.prompt.max_tokens`    | Maximum number of tokens in the generated response | `200000`                               |
| `commiter_ai.prompt.custom_prompt` | Custom instructions to override default behavior   | `""`                                   |
| `commiter_ai.prompt.temperature`   | Creativity level of the AI (0.0-2.0)               | `0.7`                                  |
| `commiter_ai.prompt.model`         | OpenRouter AI model to use                         | `google/gemini-2.0-pro-exp-02-05:free` |
| `commiter_ai.prompt.commit_style`  | Predefined commit message style                    | `conventional`                         |
| `commiter_ai.sound_enabled`        | Enable/disable sound feedback                      | `true`                                 |

## Commit Styles

The extension supports multiple commit message styles:

- **Conventional**: Standard format for automated changelogs (`type: description`)
- **Linus**: Title followed by detailed paragraph explanation
- **Imperative**: Verb-first commands in present tense
- **Prefix**: Simple category with brief description
- **Context**: Component or area-specific notation
- **Ticket**: References to task tracking systems
- **Symbol**: Visual indicators for different types of changes
- **Concise**: Brief summaries without special formatting

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

For issues, create a ticket in our [GitHub Issues](https://github.com/rafaeelricco/commiter-ai/issues).

## License

[MIT](LICENSE)

## Author

[Rafael Ricco](https://github.com/rafaeelricco)
