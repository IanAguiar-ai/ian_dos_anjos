DATA_HORA=$(date +"%d-%m-%Y - %H:%M")
MENSAGEM_COMMIT="$DATA_HORA"

git add .
git commit -m "$MENSAGEM_COMMIT"
git push origin main
