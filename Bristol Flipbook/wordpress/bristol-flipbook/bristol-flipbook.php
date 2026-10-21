<?php
/**
 * Plugin Name: Bristol Flipbook
 * Description: Embedded Google Drive catalogue viewer with automatic PDF loading.
 * Version: 0.1.4
 * Requires PHP: 7.4
 */
defined('ABSPATH') || exit;

add_action('admin_init', function () {
    register_setting('bristol_flipbook', 'bristol_flipbook_api_key', array(
        'type' => 'string', 'sanitize_callback' => 'sanitize_text_field', 'show_in_rest' => false,
    ));
});
add_action('admin_menu', function () {
    add_options_page('Bristol Flipbook', 'Bristol Flipbook', 'manage_options', 'bristol-flipbook', 'bristol_flipbook_settings');
});
function bristol_flipbook_settings() {
    if (!current_user_can('manage_options')) { return; }
    ?>
    <div class="wrap"><h1>Bristol Flipbook</h1>
    <p>Syron is configured. Add your Google Drive browser API key to enable automatic loading.</p>
    <p>This browser key is visible to visitors. Restrict it in Google Cloud to the Google Drive API and your website origin before saving it.</p>
    <p>Website restriction: <code><?php echo esc_html(home_url('/*')); ?></code>. Enable Google Drive API in the key's project. The PDF must allow public viewing and downloading.</p>
    <form action="options.php" method="post">
    <?php settings_fields('bristol_flipbook'); ?>
    <p><label for="bristol-key">Google Drive browser API key</label></p>
    <input id="bristol-key" name="bristol_flipbook_api_key" type="password" autocomplete="new-password" class="regular-text" value="<?php echo esc_attr(get_option('bristol_flipbook_api_key', '')); ?>">
    <?php submit_button(); ?>
    </form><p>Place <code>[bristol_flipbook catalogue="syron"]</code> in a Shortcode block on the Flipbook page.</p></div>
    <?php
}
function bristol_flipbook_catalogues() {
    return array('syron' => array('title' => 'Syron', 'fileId' => '1NQqJlAJxW0MnPzFwbFCF1Vt9L4sEGCN4'));
}
add_shortcode('bristol_flipbook', function ($attributes) {
    $attributes = shortcode_atts(array('catalogue' => 'syron'), $attributes, 'bristol_flipbook');
    $catalogues = bristol_flipbook_catalogues();
    $slug = sanitize_key($attributes['catalogue']);
    if (!isset($catalogues[$slug])) { return '<p>Catalogue unavailable.</p>'; }
    $url = add_query_arg(array('bristol_flipbook_viewer' => '1', 'catalogue' => $slug), home_url('/'));
    return '<iframe title="' . esc_attr($catalogues[$slug]['title'] . ' catalogue flipbook') . '" src="' . esc_url($url) . '" style="display:block;width:100%;height:80vh;min-height:440px;border:0" loading="lazy" allow="fullscreen" allowfullscreen></iframe>';
});
add_action('template_redirect', function () {
    if (!isset($_GET['bristol_flipbook_viewer']) || !is_string($_GET['bristol_flipbook_viewer']) || $_GET['bristol_flipbook_viewer'] !== '1') { return; }
    $slug = isset($_GET['catalogue']) && is_string($_GET['catalogue']) ? sanitize_key(wp_unslash($_GET['catalogue'])) : 'syron';
    $catalogues = bristol_flipbook_catalogues();
    if (!isset($catalogues[$slug])) { wp_die('Catalogue unavailable.', 'Catalogue unavailable', array('response' => 404)); }
    $key = get_option('bristol_flipbook_api_key', '');
    if (!$key) { wp_die('The catalogue viewer is awaiting configuration. Please contact the site administrator.', 'Catalogue setup', array('response' => 503)); }
    $html = file_get_contents(__DIR__ . '/assets/viewer.html');
    if ($html === false) { wp_die('Viewer files are missing.', 'Catalogue setup', array('response' => 500)); }
    $config = $catalogues[$slug];
    $config['apiKey'] = $key;
    status_header(200);
    nocache_headers();
    header('Content-Type: text/html; charset=UTF-8');
    header('X-Frame-Options: SAMEORIGIN');
    header("Content-Security-Policy: frame-ancestors 'self'");
    header('X-Content-Type-Options: nosniff');
    echo str_replace(array('__BRISTOL_CONFIG__', '__BRISTOL_ASSET_BASE__'), array(
        wp_json_encode($config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT),
        esc_url(plugins_url('assets/', __FILE__)),
    ), $html);
    exit;
}, 0);
