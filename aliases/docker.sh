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
    elif [ -f "docker-compose.yml" ]; then
        DOCKER_COMPOSE_FILE='docker-compose.yml'
    elif [ -f "docker-compose.test.yml" ]; then
        DOCKER_COMPOSE_FILE='docker-compose.test.yml'
    fi

    if [[ "$1" == "--show" ]]; then
        shift 1
        echo "File: $DOCKER_COMPOSE_FILE"
    fi

    docker compose -f "$DOCKER_COMPOSE_FILE" "$@"
}

alias dc='d-compose'
alias dcup='d-compose up -d'
alias d-bash='d-compose exec app bash'
alias d-php='d-compose exec app php'
alias d-test='d-compose exec app ./vendor/bin/phpunit'

alias d-exec='d-compose exec app'

# Docker redis
alias d-redis='d-compose exec cache redis-cli'
alias d-redis-flushall='d-compose exec cache redis-cli flushall'

# Php versions
alias d-php71='docker run --rm -v $(pwd):/app -w /app php:7.1'
alias d-php72='docker run --rm -v $(pwd):/app -w /app php:7.2'
alias d-php73='docker run --rm -v $(pwd):/app -w /app php:7.3'
alias d-php74='docker run --rm -v $(pwd):/app -w /app php:7.4'
alias d-php80='docker run --rm -v $(pwd):/app -w /app php:8.0'

# Composer with php versions
alias d-composer71='docker run --rm --volume $(pwd):/app prooph/composer:7.1'
alias d-composer72='docker run --rm --volume $(pwd):/app prooph/composer:7.2'
alias d-composer73='docker run --rm --volume $(pwd):/app prooph/composer:7.3'
alias d-composer74='docker run --rm --volume $(pwd):/opt -w /opt laravelsail/php74-composer:latest composer'
alias d-composer80='docker run --rm --volume $(pwd):/opt -w /opt laravelsail/php80-composer:latest composer'

# Nodejs
alias d-node10='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:10'
alias d-node12='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:12'
alias d-node14='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:14'
alias d-node16='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:16'

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
        -e CLIP="$(pbpaste)" \
        -e INIT="/var/scripts/init.red" \
        hasansemih/red
}

red-with-folder() {
    docker run --rm -it --platform=linux/386 \
        -v red-console:/root/.red \
        -v "$HOME/Projects/custom-red-language-scripts":/var/scripts \
        -v "${PWD}":/var/app \
        -e CLIP="$(pbpaste)" \
        -e INIT="/var/scripts/init.red" \
        hasansemih/red
}

red-desk() {
    cd ~/Desktop/red
    red-with-folder
}