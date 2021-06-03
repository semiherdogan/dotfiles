##
# Laravel
##

alias a='artisan'
alias tinker='artisan tinker'
alias migrate='artisan migrate'
alias migrate:status='artisan migrate:status'
alias migrate:rollback='artisan migrate:rollback'

alias sail='vendor/bin/sail'

alias lr='laravel--delete-log-files && exit 0'

# Enable autocomplete for artisan command
if [ -x "$(command -v compdef)" ]; then
    compdef _artisan_command_list_for_autocomplete artisan

    _artisan_command_list_for_autocomplete() {
        # local artisanCommandList=$(artisan list --format=json | jq -r '.commands[] .name')
        _arguments '1: :(tinker cache:clear migrate horizon:terminate telescope:clear)'
    }
fi

artisan () {
    if [ ! -f "docker-compose.yml" ]; then
        php artisan "$@"
        return 0
    fi

    if d-compose ps | grep 'Exit' &> /dev/null; then
        echo "${C_RED}Docker is not running.${NC}"

        if [[ "$1" == "-f" || "$2" == "-f" ]]; then
            shift 1
            php artisan "$@"
            return 0
        fi

        return 1
    fi

    if [ ! -n "$(d-compose ps -q)" ]; then
        echo "${C_RED}Docker is not running.${NC}"

        if [[ "$1" == "-f" || "$2" == "-f" ]]; then
            shift 1
            php artisan "$@"
            return 0
        fi

        return 1
    fi

    if [[ -f "vendor/bin/sail" ]]; then
        ./vendor/bin/sail artisan "$@"
    else
        d-compose exec app php artisan "$@"
    fi
}

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
