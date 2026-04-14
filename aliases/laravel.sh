##
# Laravel
##

artisan() {
    php -d memory_limit=-1 artisan "$@"
}

alias a='artisan'
alias da='docker-artisan'
alias tinker='artisan tinker'
alias migrate='artisan migrate'
alias migrate-status='artisan migrate:status'
alias migrate-rollback='artisan migrate:rollback'
alias migrate-fresh='artisan db:wipe; artisan migrate --seed'
alias mf='migrate-fresh'

alias sail='vendor/bin/sail'

alias pest='vendor/bin/pest'
alias pest-filter='vendor/bin/pest --filter'

alias pint='vendor/bin/pint'
alias pint-lint='vendor/bin/pint --test'

alias composer-here-latest='curl -sS https://getcomposer.org/installer | php'
alias composer-here-1='wget https://github.com/composer/composer/releases/download/1.10.26/composer.phar'

_artisan_command_list_for_autocomplete() {
    _arguments '1: :(tinker cache:clear view:clear migrate migrate:status db:seed db:wipe horizon:terminate telescope:clear route:list)'
}

if command -v compdef >/dev/null 2>&1; then
    compdef _artisan_command_list_for_autocomplete artisan
fi

docker-artisan () {
    if [ ! -f "artisan" ]; then
        echo "artisan file not found."
        return 1
    fi

    if ! d-compose --show >/dev/null 2>&1; then
        artisan "$@"
        return 0
    fi

    if dc ps | grep 'Exit' >/dev/null 2>&1; then
        echo "Docker is not running."

        if [ "$1" = "-f" ]; then
            shift 1
            artisan "$@"
            return 0
        fi

        return 1
    fi

    if [ -z "$(dc ps -q)" ]; then
        echo "Docker is not running."

        if [ "$1" = "-f" ]; then
            shift 1
            artisan "$@"
            return 0
        fi

        return 1
    fi

    if dc ps | grep 'app' >/dev/null 2>&1; then
        dc exec app php -d memory_limit=-1 artisan "$@"
        return 0
    fi

    artisan "$@"
}

alias lr='laravel--delete-log-files'
laravel--delete-log-files () {
    local current_path
    local current_date
    local log_file

    current_path="$(pwd)"
    current_date="$(date '+%Y-%m-%d')"

    LOG_FILES_TO_KEEP=(
        laravel.log
        "laravel-$current_date.log"
    )

    if [ ! -d "storage/logs" ]; then
        echo "storage/logs not found."
        return 1
    fi

    cd storage/logs || return 1

    for LOG_FILE in "${LOG_FILES_TO_KEEP[@]}"
    do
        if [ -f "$LOG_FILE" ]; then
            : > "$LOG_FILE"
        fi
    done

    for log_file in *; do
        if [ "$log_file" != "laravel.log" ] && [ "$log_file" != "laravel-$current_date.log" ]; then
            rm -f "$log_file"
        fi
    done

    cd "$current_path" || return 1
}
