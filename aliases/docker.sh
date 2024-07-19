##
# Docker Aliases
##

# Docker (d)
alias d-ps='docker ps'
alias d-stop-all='docker stop $(docker ps -q)'

# Docker Compose
# d-compose () {
#     local DOCKER_COMPOSE_FILE=''

#     if [ -f "docker-compose.override.yml" ]; then
#         DOCKER_COMPOSE_FILE='docker-compose.override.yml'
#     elif [ -f "docker-compose.dev.yml" ]; then
#         DOCKER_COMPOSE_FILE='docker-compose.dev.yml'
#     elif [ -f "docker-compose-dev.yml" ]; then
#         DOCKER_COMPOSE_FILE='docker-compose-dev.yml'
#     elif [ -f "docker-compose-local.yml" ]; then
#         DOCKER_COMPOSE_FILE='docker-compose-local.yml'
#     elif [ -f "docker-compose.yml" ]; then
#         DOCKER_COMPOSE_FILE='docker-compose.yml'
#     elif [ -f "docker-compose.test.yml" ]; then
#         DOCKER_COMPOSE_FILE='docker-compose.test.yml'
#     fi

#     if [[ "$1" == "--show" ]]; then
#         shift 1
#         echo "File: $DOCKER_COMPOSE_FILE"
#     fi

#     if [[ $DOCKER_COMPOSE_FILE == "" ]]; then
#         echo "Docker file not found."
#         return 1
#     fi

#     docker compose -f "$DOCKER_COMPOSE_FILE" "$@"
# }

alias dc='~/Path/dc'
alias dcup='dc up -d'
alias dc-exec='dc exec'
alias dc-app='dc exec app'
alias dc-bash='dc exec app bash'
alias dc-sh='dc exec app sh'
alias dc-php='dc exec app php -d "memory_limit = -1"'

# Docker redis
alias dc-redis='dc exec cache redis-cli'
alias dc-redis-flushall='dc exec cache redis-cli flushall'

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
alias d-composer83='docker run --rm --volume $(pwd):/app prooph/composer:8.3'

# Nodejs
alias d-node10='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:10'
alias d-node12='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:12'
alias d-node14='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:14'
alias d-node16='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:16'

alias c='composer'
alias cr='composer run'

composer() {
    # Local composer path
    local COMPOSER_COMMAND="~/Path/composer"

    if [ -f "composer.phar" ]; then
        COMPOSER_COMMAND="php -d memory_limit=-1 composer.phar"
    fi

    # Check docker compose file if exists
    if [ $(ls -l | grep 'docker-compose' | wc -l) -eq 0 ]; then
        eval "$COMPOSER_COMMAND $@"
        return 0
    fi

    if dc ps | grep 'Exit' &> /dev/null; then
        echo "${C_RED}Docker is not running.${NC}"

        if [[ "$1" == "-f" ]]; then
            shift 1
            eval "$COMPOSER_COMMAND $@"
            return 0
        fi

        return 1
    fi

    if [ ! -n "$(dc ps -q)" ]; then
        echo "${C_RED}Docker is not running.${NC}"

        if [[ "$1" == "-f" ]]; then
            shift 1
            eval "$COMPOSER_COMMAND $@"
            return 0
        fi

        return 1
    fi

    if [ ! -f "composer.phar" ]; then
        COMPOSER_COMMAND="composer"
    fi

    # echo "Running inside docker 'app' container"
    # echo "==========="

    dc exec app ${(Q)${(z)COMPOSER_COMMAND}} "$@"
}

# red() {
#     docker run --rm -it --platform=linux/386 \
#         -v red-console:/root/.red \
#         -v "$HOME/Projects/custom-red-language-scripts":/var/scripts \
#         -e CLIP="$(cb --paste0)" \
#         -e INIT="/var/scripts/init.red" \
#         hasansemih/red
# }
