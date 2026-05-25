# Cursor / VS Code integrated terminal: use repo .nvmrc even when nvm default is another version.
# terminal.integrated.profiles sets ZDOTDIR to this directory.

if [[ -z "${NVM_DIR:-}" ]]; then
  export NVM_DIR="$HOME/.nvm"
fi
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  source "$NVM_DIR/nvm.sh"
elif [[ -s /opt/homebrew/opt/nvm/nvm.sh ]]; then
  source /opt/homebrew/opt/nvm/nvm.sh
elif [[ -s /usr/local/opt/nvm/nvm.sh ]]; then
  source /usr/local/opt/nvm/nvm.sh
fi

[[ -f "$HOME/.zshrc" ]] && source "$HOME/.zshrc"

if [[ -f ".nvmrc" ]] && command -v nvm >/dev/null 2>&1; then
  nvm use --silent 2>/dev/null || nvm use
fi
