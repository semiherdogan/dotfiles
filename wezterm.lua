local wezterm = require 'wezterm'
local act = wezterm.action

local config = wezterm.config_builder()

config.initial_cols = 120
config.initial_rows = 28

config.font = wezterm.font_with_fallback {
    { family = 'JetBrains Mono', weight = 'DemiBold' },
    { family = 'SF Mono', weight = 'DemiBold' },
    { family = 'Menlo', weight = 'DemiBold' },
}
config.font_size = 13
config.line_height = 1.2

config.color_scheme = 'Tokyo Night'
config.window_background_opacity = 0.96
config.macos_window_background_blur = 16

config.window_padding = {
    left = 12,
    right = 12,
    top = 10,
    bottom = 8,
}

config.scrollback_lines = 100000
config.audible_bell = 'Disabled'
config.check_for_updates = false

config.use_fancy_tab_bar = false
config.hide_tab_bar_if_only_one_tab = true
config.tab_bar_at_bottom = true

config.window_close_confirmation = 'NeverPrompt'
config.adjust_window_size_when_changing_font_size = false
config.native_macos_fullscreen_mode = true

config.keys = {
    { key = 'Enter', mods = 'ALT', action = act.ToggleFullScreen },
    { key = 't', mods = 'CMD', action = act.SpawnTab 'CurrentPaneDomain' },
    { key = 'w', mods = 'CMD', action = act.CloseCurrentTab { confirm = false } },
    { key = 'd', mods = 'CMD', action = act.SplitHorizontal { domain = 'CurrentPaneDomain' } },
    { key = 'd', mods = 'CMD|SHIFT', action = act.SplitVertical { domain = 'CurrentPaneDomain' } },
    { key = 'h', mods = 'CMD|SHIFT', action = act.ActivatePaneDirection 'Left' },
    { key = 'j', mods = 'CMD|SHIFT', action = act.ActivatePaneDirection 'Down' },
    { key = 'k', mods = 'CMD|SHIFT', action = act.ActivatePaneDirection 'Up' },
    { key = 'l', mods = 'CMD|SHIFT', action = act.ActivatePaneDirection 'Right' },
    { key = 'LeftArrow', mods = 'CMD|ALT', action = act.ActivateTabRelative(-1) },
    { key = 'RightArrow', mods = 'CMD|ALT', action = act.ActivateTabRelative(1) },
    { key = 'f', mods = 'CMD|SHIFT', action = act.Search 'CurrentSelectionOrEmptyString' },
    { key = 'r', mods = 'CMD|SHIFT', action = act.ReloadConfiguration },
}

wezterm.on('gui-startup', function(cmd)
    local screen = wezterm.gui.screens().active
    local width = math.floor(screen.width * 0.55)
    local height = math.floor(screen.height * 0.4)
    local _, _, window = wezterm.mux.spawn_window {
        args = cmd and cmd.args or nil,
        position = {
            x = (screen.width - width) / 2,
            y = (screen.height - height) / 2,
            origin = 'ActiveScreen',
        },
    }

    window:gui_window():set_inner_size(width, height)
end)

return config
