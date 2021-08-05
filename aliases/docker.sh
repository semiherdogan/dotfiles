##
# Docker Aliases
##

# Docker (d)
alias d-ps='docker ps'
alias d-stop='docker stop $(docker ps -q)'

# Docker Compose
d-compose () {
    local DOCKER_COMPOSE_FILE='docker-compose.yml'

    if [ -f "docker-compose.override.yml" ]; then
        DOCKER_COMPOSE_FILE='docker-compose.override.yml'
    elif [ -f "docker-compose-dev.yml" ]; then
        DOCKER_COMPOSE_FILE='docker-compose-dev.yml'
    fi

    docker compose -f "$DOCKER_COMPOSE_FILE" "$@"
}

alias dc='d-compose'
alias dcup='d-compose up -d'
alias d-bash='d-compose exec app bash'
alias d-php='d-compose exec app php'
alias d-test='d-compose exec app ./vendor/bin/phpunit'

# Docker redis
alias d-redis='d-compose exec cache redis-cli'
alias d-redis-flushall='d-compose exec cache redis-cli flushall'

# Php versions
alias php71='docker run --rm -v $(pwd):/app -w /app php:7.1'
alias php72='docker run --rm -v $(pwd):/app -w /app php:7.2'
alias php73='docker run --rm -v $(pwd):/app -w /app php:7.3'
alias php74='docker run --rm -v $(pwd):/app -w /app php:7.4'
alias php80='docker run --rm -v $(pwd):/app -w /app php:8.0'

# Composer with php versions
alias composer-71='docker run --rm --volume $(pwd):/app prooph/composer:7.1'
alias composer-72='docker run --rm --volume $(pwd):/app prooph/composer:7.2'
alias composer-73='docker run --rm --volume $(pwd):/app prooph/composer:7.3'
alias composer-74='docker run --rm --volume $(pwd):/opt -w /opt laravelsail/php74-composer:latest composer'
alias composer-80='docker run --rm --volume $(pwd):/opt -w /opt laravelsail/php80-composer:latest composer'

# Nodejs
alias node='node12'
alias node12='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:12'
alias node14='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:14'
alias node16='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:16'

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
