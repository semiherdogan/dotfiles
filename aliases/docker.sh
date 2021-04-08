##
# Docker Aliases
##

# Docker (d)
alias d-ps='docker ps'
alias d-stop='docker stop $(docker ps -q)'

# Docker Compose (dc)
docker-compose () {
    local DOCKER_COMPOSE_FILE='docker-compose.yml'

    if [ -f "docker-compose-semih.yml" ]; then
        DOCKER_COMPOSE_FILE='docker-compose-semih.yml'
    elif [ -f "docker-compose-local.yml" ]; then
        DOCKER_COMPOSE_FILE='docker-compose-local.yml'
    elif [ -f "docker-compose-dev.yml" ]; then
        DOCKER_COMPOSE_FILE='docker-compose-dev.yml'
    fi

    /usr/local/bin/docker-compose -f "$DOCKER_COMPOSE_FILE" "$@"
}

alias dc='docker-compose'
alias dcup='docker-compose up -d'
alias d-bash='docker-compose exec app bash'
alias d-php='docker-compose exec app php'
alias d-test='docker-compose exec app ./vendor/bin/phpunit'

# Docker redis
alias d-redis='docker-compose exec cache redis-cli'
alias d-redis-flushall='docker-compose exec cache redis-cli flushall'

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
