##
# Docker Aliases
##

# Docker (d)
alias d-ps='docker ps'
alias d-stop-all='docker stop $(docker ps -q)'

#  Docker Compose
d-compose() {
    local files=(
        "docker-compose.override.yml"
        "docker-compose-override.yml"

        "docker-compose.dev.yml"
        "docker-compose-dev.yml"

        "docker-compose-local.yml"
        "docker-compose.local.yml"

        "docker-compose.yml"

        "docker-compose.test.yml"
        "docker-compose-test.yml"
    )

    local DOCKER_COMPOSE_FILE=''

    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            DOCKER_COMPOSE_FILE="$file"
            break
        fi
    done

    if [[ -z $DOCKER_COMPOSE_FILE ]]; then
        echo "Docker file not found."
        return 1
    fi

    if [[ "$1" == "--show" ]]; then
        echo "File: $DOCKER_COMPOSE_FILE"
        shift
    fi

    docker compose -f "$DOCKER_COMPOSE_FILE" "$@"
}

alias dc='d-compose'
alias dcup='dc up -d'
alias dc-exec='dc exec'
alias dc-app='dc exec app'
alias dc-bash='dc exec app bash'
alias dc-sh='dc exec app sh'
alias dc-php='dc exec app php -d "memory_limit = -1"'

# Nodejs
alias node20='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:20'

# Composer
co() {
    local COMPOSER_CMD="composer"
    [ -f "composer.phar" ] && COMPOSER_CMD="php -d memory_limit=-1 composer.phar"

    # If docker-compose is not found, run the command locally
    if [ $(ls -l | grep 'docker-compose' | wc -l) -eq 0 ]; then
        eval "$COMPOSER_CMD $@"
        return 0
    fi

    if ! dc ps | grep -q '.'; then
        echo "Docker is not running."

        # If the force flag is used, run the command regardless
        if [[ "$1" == "-f" ]]; then
            shift
            eval "$COMPOSER_CMD $@"
            return 0
        fi

        return 1
    fi

    if dc ps | grep 'app' &> /dev/null; then
        echo "Running composer in the app container."
        dc exec app ${(Q)${(z)COMPOSER_CMD}} "$@"
        return 0
    fi

    eval "$COMPOSER_CMD $@"
}
