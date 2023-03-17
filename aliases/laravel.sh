##
# Laravel
##

alias a='artisan'
alias tinker='artisan tinker'
alias migrate='artisan migrate'
alias migrate:status='artisan migrate:status'
alias migrate:rollback='artisan migrate:rollback'

alias sail='vendor/bin/sail'

alias pest='vendor/bin/pest'
alias pest-filter='vendor/bin/pest --filter'

alias pint='vendor/bin/pint'
alias pint-lint='vendor/bin/pint --test'



# Enable autocomplete for artisan command
if [ -x "$(command -v compdef)" ]; then
    _artisan_command_list_for_autocomplete() {
        # local artisanCommandList=$(artisan list --format=json | jq -r '.commands[] .name')
        _arguments '1: :(tinker cache:clear migrate horizon:terminate telescope:clear route:list)'
    }

    compdef _artisan_command_list_for_autocomplete artisan
fi

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

function laravel-new() {
    local PROJECT_NAME="$1"

    if [[ $PROJECT_NAME == "" ]]; then
        echo "Provide a project name."

        return
    fi

    docker info > /dev/null 2>&1

    # Ensure that Docker is running...
    if [ $? -ne 0 ]; then
        echo "Docker is not running."

        exit 1
    fi

    docker run --rm \
        -v "$(pwd)":/opt \
        -w /opt \
        laravelsail/php82-composer:latest \
        bash -c "laravel new $PROJECT_NAME && cd $PROJECT_NAME && php ./artisan sail:install --with=mysql,redis"

    cd $PROJECT_NAME

    CYAN='\033[0;36m'
    LIGHT_CYAN='\033[1;36m'
    WHITE='\033[1;37m'
    NC='\033[0m'

    echo ""

    if sudo -n true 2>/dev/null; then
        sudo chown -R $USER: .
        echo -e "${WHITE}Get started with:${NC} cd $PROJECT_NAME && ./vendor/bin/sail up"
    else
        echo -e "${WHITE}Please provide your password so we can make some final adjustments to your application's permissions.${NC}"
        echo ""
        sudo chown -R $USER: .
        echo ""
        echo -e "${WHITE}Thank you! We hope you build something incredible. Dive in with:${NC} cd smh-app && ./vendor/bin/sail up"
    fi
}
