##
# Docker Aliases
##

# Docker (d)
alias d-ps='docker ps'
alias d-stop='docker stop $(docker ps -q)'

# Docker Compose
d-compose () {
    local DOCKER_COMPOSE_FILE=''

    if [ -f "docker-compose.override.yml" ]; then
        DOCKER_COMPOSE_FILE='docker-compose.override.yml'
    elif [ -f "docker-compose.dev.yml" ]; then
        DOCKER_COMPOSE_FILE='docker-compose.dev.yml'
    elif [ -f "docker-compose-local.yml" ]; then
        DOCKER_COMPOSE_FILE='docker-compose-local.yml'
    elif [ -f "docker-compose.yml" ]; then
        DOCKER_COMPOSE_FILE='docker-compose.yml'
    elif [ -f "docker-compose.test.yml" ]; then
        DOCKER_COMPOSE_FILE='docker-compose.test.yml'
    fi

    if [[ "$1" == "--show" ]]; then
        shift 1
        echo "File: $DOCKER_COMPOSE_FILE"
    fi

    if [[ $DOCKER_COMPOSE_FILE == "" ]]; then
        echo "Docker file not found."
        exit 1
    fi

    docker compose -f "$DOCKER_COMPOSE_FILE" "$@"
}

alias dc='d-compose'
alias dcup='d-compose --show up -d'
alias d-exec='d-compose exec'
alias d-app='d-exec app'
alias d-bash='d-app bash'
alias d-php='d-app php -d "memory_limit = -1"'
alias d-test='d-app app ./vendor/bin/phpunit'

# Docker redis
alias d-redis='d-exec cache redis-cli'
alias d-redis-flushall='d-exec cache redis-cli flushall'

# Php versions
alias d-php73='docker run --rm -v $(pwd):/app -w /app php:7.3'
alias d-php74='docker run --rm -v $(pwd):/app -w /app php:7.4'
alias d-php80='docker run --rm -v $(pwd):/app -w /app php:8.0'
alias d-php81='docker run --rm -v $(pwd):/app -w /app php:8.1'
alias d-php82='docker run --rm -v $(pwd):/app -w /app php:8.2'

# Composer with php versions
alias d-composer73='docker run --rm --volume $(pwd):/app prooph/composer:7.3'
alias d-composer74='docker run --rm --volume $(pwd):/app prooph/composer:7.4'
alias d-composer80='docker run --rm --volume $(pwd):/app prooph/composer:8.0'
alias d-composer81='docker run --rm --volume $(pwd):/app prooph/composer:8.1'
alias d-composer82='docker run --rm --volume $(pwd):/app prooph/composer:8.2'

# Nodejs
alias d-node10='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:10'
alias d-node12='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:12'
alias d-node14='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:14'
alias d-node16='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:16'

alias c='composer'
alias cr='composer run'

composer() {
    local COMPOSER_COMMAND="~/Path/composer"

    if [ -f "composer.phar" ]; then
        COMPOSER_COMMAND="php -d memory_limit=-1 composer.phar"
    fi

    if [ ! -f "docker-compose.yml" ]; then
        eval "$COMPOSER_COMMAND $@"
        return 0
    fi

    if d-compose ps | grep 'Exit' &> /dev/null; then
        echo "${C_RED}Docker is not running.${NC}"

        if [[ "$1" == "-f" ]]; then
            shift 1
            eval "$COMPOSER_COMMAND $@"
            return 0
        fi

        return 1
    fi

    if [ ! -n "$(docker-compose ps -q)" ]; then
        echo "${C_RED}Docker is not running.${NC}"

        if [[ "$1" == "-f" ]]; then
            shift 1
            eval "$COMPOSER_COMMAND $@"
            return 0
        fi

        return 1
    fi

    if [[ -f "vendor/bin/sail" ]]; then
        ./vendor/bin/sail composer "$@"
    else
        d-compose exec app ${(Q)${(z)COMPOSER_COMMAND}} "$@"
    fi
}

red() {
    docker run --rm -it --platform=linux/386 \
        -v red-console:/root/.red \
        -v "$HOME/Projects/custom-red-language-scripts":/var/scripts \
        -e CLIP="$(cb --paste0)" \
        -e INIT="/var/scripts/init.red" \
        hasansemih/red
}
