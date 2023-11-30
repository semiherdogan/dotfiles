##
# Laravel
##

alias a='artisan'
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

# Enable autocomplete for artisan command
# if [ -x "$(command -v compdef)" ]; then
_artisan_command_list_for_autocomplete() {
    # local artisanCommandList=$(artisan list --format=json | jq -r '.commands[] .name')
    _arguments '1: :(tinker cache:clear view:clear migrate migrate:status db:seed db:wipe horizon:terminate telescope:clear route:list)'
}

compdef _artisan_command_list_for_autocomplete artisan
# fi

artisan () {
    if [ ! -f "docker-compose.yml" ]; then
        php -d="memory_limit=-1" artisan "$@"
        return 0
    fi

    if d-compose ps | grep 'Exit' &> /dev/null; then
        echo "${C_RED}Docker is not running.${NC}"

        if [[ "$1" == "-f" ]]; then
            shift 1
            php -d="memory_limit=-1" artisan "$@"
            return 0
        fi

        return 1
    fi

    if [ ! -n "$(d-compose ps -q)" ]; then
        echo "${C_RED}Docker is not running.${NC}"

        if [[ "$1" == "-f" ]]; then
            shift 1
            php -d="memory_limit=-1" artisan "$@"
            return 0
        fi

        return 1
    fi

    if [[ -f "vendor/bin/sail" ]]; then
        ./vendor/bin/sail artisan "$@"
    else
        d-compose exec app php -d="memory_limit=-1" artisan "$@"
    fi
}

alias lr='laravel--delete-log-files'
laravel--delete-log-files () {
    CURRENT_PATH=$(pwd)
    CURRENT_DATE=$(date '+%Y-%m-%d')

    LOG_FILES_TO_KEEP=(
        laravel.log
        laravel-$CURRENT_DATE.log
    )

    cd storage/logs

    for LOG_FILE in "${LOG_FILES_TO_KEEP[@]}"
    do
        if [[ -f $LOG_FILE ]]; then
            cat /dev/null > $LOG_FILE
        fi
    done

    ls \
    | grep -v laravel.log \
    | grep -v laravel-$CURRENT_DATE.log \
    | xargs rm -f

    cd $CURRENT_PATH
}
