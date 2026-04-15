##
# Docker Aliases
##

# Docker (d)
alias d-ps='docker ps'

d-stop-all() {
    local containers=$(docker ps -q)

    if [ -z "$containers" ]; then
        echo "No running containers to stop."
        return 0
    fi

    if [[ "$containers" == *" "* ]]; then
        docker ps --format "table {{.ID}}\t{{.Names}}" | grep -E "^(${containers// /|})" || true
    else
        docker ps --format "table {{.ID}}\t{{.Names}}" | grep -E "^$containers" || true
    fi

    echo ""

    printf '%s\n' "$containers" | xargs docker stop > /dev/null 2>&1

    echo "Stopped all running containers."
}

#  Docker Compose
d-compose() {
    local file
    local docker_compose_file=''
    local -a files=(
        "docker-compose.override.yml"
        "docker-compose-override.yml"

        "docker-compose.local.yml"
        "docker-compose-local.yml"
        "docker-compose.dev.yml"
        "docker-compose-dev.yml"

        "docker-compose.yml"
        "docker-compose.yaml"
        "compose.yml"

        "docker-compose.test.yml"
        "docker-compose-test.yml"
        "docker-compose.stage.yml"
        "docker-compose-stage.yml"
        "docker-compose.prod.yml"
        "docker-compose-prod.yml"
    )

    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            docker_compose_file="$file"
            break
        fi
    done

    if [ -z "$docker_compose_file" ]; then
        for file in "${files[@]}"; do
            if [ -f "./docker/$file" ]; then
                docker_compose_file="./docker/$file"
                break
            fi
        done
    fi

    if [ -z "$docker_compose_file" ]; then
        echo "Docker compose file not found."
        return 1
    fi

    if [ "$1" = "--show" ]; then
        printf 'File: %s\n' "$docker_compose_file"
        shift

        if [ "$#" -eq 0 ]; then
            return 0
        fi
    fi

    if [ -f "vendor/bin/sail" ]; then
        vendor/bin/sail -f "$docker_compose_file" "$@"
        return 0
    fi

    docker compose -f "$docker_compose_file" "$@"
}

alias dc='d-compose'
alias dcup='dc up -d'
alias dc-exec='dc exec'
alias dc-app='dc exec app'
alias dc-bash='dc exec app bash'
alias dc-sh='dc exec app sh'
alias dc-php='dc exec app php -d memory_limit=-1'

# Nodejs
alias node20='docker run -it --rm --name my-running-script -v "$PWD":/usr/src/app -w /usr/src/app node:20'

_composer_command() {
    if [ -f "composer.phar" ]; then
        printf 'php\n-d\nmemory_limit=-1\ncomposer.phar\n'
        return 0
    fi

    if command -v composer >/dev/null 2>&1; then
        printf 'composer\n'
        return 0
    fi

    return 1
}

co() {
    local force_local=0
    local line
    local -a composer_cmd=()

    if [ "$1" = "-f" ]; then
        force_local=1
        shift
    fi

    while IFS= read -r line; do
        composer_cmd+=("$line")
    done <<EOF
$(_composer_command)
EOF

    if [ "${#composer_cmd[@]}" -eq 0 ]; then
        echo "Composer is not installed."
        return 1
    fi

    if [ "$force_local" -eq 1 ]; then
        "${composer_cmd[@]}" "$@"
        return 0
    fi

    if ! d-compose --show >/dev/null 2>&1; then
        "${composer_cmd[@]}" "$@"
        return 0
    fi

    if ! dc ps | grep -q '.'; then
        echo "Docker is not running."
        return 1
    fi

    if dc ps | grep 'app' >/dev/null 2>&1; then
        echo "Running composer in the app container."
        dc exec app "${composer_cmd[@]}" "$@"
        return 0
    fi

    "${composer_cmd[@]}" "$@"
}
