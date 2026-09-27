<?php
/**
 * Plugin Name:       کیا کور — KIYA Core
 * Plugin URI:        https://kiya.shop
 * Description:       ورود و ثبت‌نام با اکانت تلگرام، اعلان سفارش به ربات مدیر، و تأیید/رد پرداخت کارت‌به‌کارت مستقیماً از تلگرام.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            KIYA
 * License:           GPL-2.0-or-later
 * Text Domain:       kiya-core
 */

if (!defined('ABSPATH')) {
    exit;
}

define('KIYA_CORE_VERSION', '1.0.0');

// بارگذاری درگاه کارت به کارت (رسید + تأیید از پنل)
require_once plugin_dir_path(__FILE__) . 'kiya-card-to-card.php';

/* ============================================================
 *  ۱. تنظیمات
 * ============================================================ */

function kiya_get_option($key, $default = '')
{
    return get_option('kiya_' . $key, $default);
}

/* ============================================================
 *  ۲. ارتباط با Bot API تلگرام
 * ============================================================ */

function kiya_tg_api($method, $params = array())
{
    $token = kiya_get_option('tg_token');
    if (!$token) {
        return new WP_Error('kiya_no_token', 'توکن ربات تلگرام تنظیم نشده است.');
    }

    $response = wp_remote_post('https://api.telegram.org/bot' . $token . '/' . $method, array(
        'body'    => $params,
        'timeout' => 20,
    ));

    if (is_wp_error($response)) {
        return $response;
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);
    return is_array($body) ? $body : new WP_Error('kiya_bad_response', 'پاسخ نامعتبر از تلگرام');
}

/* ============================================================
 *  ۳. ورود / ثبت‌نام با تلگرام
 * ============================================================ */

/**
 * اعتبارسنجی امضای ورود تلگرام (مستندات رسمی تلگرام)
 */
function kiya_tg_verify_auth($data)
{
    $token = kiya_get_option('tg_token');
    if (!$token || empty($data['hash']) || empty($data['id'])) {
        return false;
    }

    // تازگی ورود: حداکثر ۲۴ ساعت
    if (!empty($data['auth_date']) && (time() - absint($data['auth_date'])) > DAY_IN_SECONDS) {
        return false;
    }

    $check_hash = $data['hash'];
    unset($data['hash']);

    ksort($data);
    $lines = array();
    foreach ($data as $key => $value) {
        if ($value === '' || $value === null) {
            continue;
        }
        $lines[] = $key . '=' . $value;
    }
    $data_check_string = implode("\n", $lines);
    $secret_key       = hash('sha256', $token, true);
    $my_hash          = hash_hmac('sha256', $data_check_string, $secret_key);

    return hash_equals($my_hash, $check_hash);
}

/**
 * ورود یا ساخت کاربر بر اساس اکانت تلگرام
 */
function kiya_tg_authenticate($data)
{
    if (!kiya_tg_verify_auth($data)) {
        return new WP_Error('kiya_invalid_auth', 'اعتبارسنجی امنیتی ورود تلگرام ناموفق بود.');
    }

    $telegram_id = absint($data['id']);

    // جستجوی کاربر موجود با متای تلگرام
    $existing = get_users(array(
        'meta_key'   => 'kiya_telegram_id',
        'meta_value' => $telegram_id,
        'number'     => 1,
        'fields'     => 'ID',
    ));

    if (!empty($existing)) {
        $user_id = (int) $existing[0];
    } else {
        // ساخت حساب جدید
        $first_name = sanitize_text_field(isset($data['first_name']) ? $data['first_name'] : '');
        $user_id    = wp_insert_user(array(
            'user_login'   => 'tg_' . $telegram_id,
            'user_pass'    => wp_generate_password(24, true, true),
            'user_email'   => 'tg' . $telegram_id . '@telegram.local',
            'display_name' => $first_name !== '' ? $first_name : 'مشتری کیا',
            'first_name'   => $first_name,
            'last_name'    => sanitize_text_field(isset($data['last_name']) ? $data['last_name'] : ''),
            'role'         => 'customer',
        ));

        if (is_wp_error($user_id)) {
            return $user_id;
        }

        update_user_meta($user_id, 'kiya_telegram_id', $telegram_id);
        if (!empty($data['username'])) {
            update_user_meta($user_id, 'kiya_telegram_username', sanitize_text_field($data['username']));
        }
        if (!empty($data['photo_url'])) {
            update_user_meta($user_id, 'kiya_telegram_photo', esc_url_raw($data['photo_url']));
        }
    }

    wp_set_current_user($user_id);
    wp_set_auth_cookie($user_id, true);
    do_action('wp_login', get_userdata($user_id)->user_login, get_userdata($user_id));

    return $user_id;
}

/**
 * دریافت پارامترهای ورود تلگرام از آدرس بازگشتی
 */
add_action('init', function () {
    if (empty($_GET['kiya_tg_auth']) || empty($_GET['hash'])) {
        return;
    }

    // فقط کلیدهای معتبر تلگرام را بگیر
    $allowed = array('id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash');
    $data    = array();
    foreach ($allowed as $key) {
        if (isset($_GET[$key])) {
            $data[$key] = sanitize_text_field(wp_unslash($_GET[$key]));
        }
    }

    $result = kiya_tg_authenticate($data);

    if (is_wp_error($result)) {
        wp_safe_redirect(add_query_arg(
            'kiya_tg_error',
            rawurlencode($result->get_error_message()),
            function_exists('wc_get_page_permalink') ? wc_get_page_permalink('myaccount') : wp_login_url()
        ));
    } else {
        wp_safe_redirect(function_exists('wc_get_page_permalink') ? wc_get_page_permalink('myaccount') : home_url('/'));
    }
    exit;
});

/**
 * دکمهٔ «ورود با تلگرام»
 */
function kiya_tg_render_login_button($echo = true)
{
    $username = kiya_get_option('tg_username');
    if (!$username) {
        return '';
    }

    $auth_url = function_exists('wc_get_page_permalink') ? wc_get_page_permalink('myaccount') : wp_login_url();

    $html = '<div class="kiya-tg-login" style="margin:18px 0;text-align:center">'
        . '<script async src="https://telegram.org/js/telegram-widget.js?22" '
        . 'data-telegram-login="' . esc_attr($username) . '" '
        . 'data-size="large" data-radius="12" data-request-access="write" '
        . 'data-auth-url="' . esc_url($auth_url) . '"></script>'
        . '<p style="font-size:12px;color:#777;margin-top:6px">با یک کلیک وارد شوید — بدون رمز عبور</p>'
        . '</div>';

    if ($echo) {
        echo $html;
    }
    return $html;
}
add_shortcode('kiya_telegram_login', function () {
    return kiya_tg_render_login_button(false);
});

// نمایش دکمه در فرم ورود ووکامرس و صفحهٔ ورود وردپرس
add_action('woocommerce_login_form_end', function () {
    echo '<div style="grid-column:1/-1">' . kiya_tg_render_login_button(false) . '</div>';
});
add_action('login_form_top', function () {
    echo kiya_tg_render_login_button(false);
});

/* ============================================================
 *  ۴. اعلان سفارش به ربات مدیر + تأیید/رد از تلگرام
 * ============================================================ */

/**
 * ارسال خلاصهٔ سفارش به چت مدیر با دکمه‌های تأیید
 */
function kiya_tg_notify_order($order_id)
{
    if (!function_exists('wc_get_order')) {
        return;
    }

    $order   = wc_get_order($order_id);
    if (!$order) {
        return;
    }

    $chat_id = kiya_get_option('tg_admin_chat');
    if (!$chat_id) {
        return;
    }

    $items_text = '';
    foreach ($order->get_items() as $item) {
        $qty        = $item->get_quantity();
        $total      = $order->get_formatted_line_subtotal($item);
        $items_text .= '• ' . $item->get_name() . ' × ' . $qty . ' — ' . $total . "\n";
    }

    $payment_title = $order->get_payment_method_title();
    $status        = $order->get_status();

    $message  = "🛍️ <b>سفارش جدید کیا</b>\n\n";
    $message .= "🔢 کد: <b>#" . $order->get_order_number() . "</b>\n";
    $message .= "👤 " . esc_html($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()) . "\n";
    $message .= "📞 " . esc_html($order->get_billing_phone()) . "\n";
    $message .= "🏙️ " . esc_html($order->get_billing_city()) . "\n";
    $message .= "💳 روش پرداخت: " . esc_html($payment_title) . "\n";
    $message .= "📦 وضعیت: " . esc_html(wc_get_order_status_name($status)) . "\n\n";
    $message .= "<b>اقلام:</b>\n" . $items_text . "\n";
    $message .= "💰 <b>مبلغ: " . $order->get_formatted_order_total() . "</b>";

    // دکمه‌های مدیریت وضعیت
    $secret = kiya_tg_secret();
    $keyboard = array(
        'inline_keyboard' => array(
            array(
                array('text' => '✅ تأیید پرداخت', 'callback_data' => 'kiya_pay_' . $order_id . '_' . $secret),
                array('text' => '❌ رد', 'callback_data' => 'kiya_cancel_' . $order_id . '_' . $secret),
            ),
            array(
                array('text' => '📦 در حال آماده‌سازی', 'callback_data' => 'kiya_processing_' . $order_id . '_' . $secret),
                array('text' => '🚚 ارسال شد', 'callback_data' => 'kiya_completed_' . $order_id . '_' . $secret),
            ),
        ),
    );

    kiya_tg_api('sendMessage', array(
        'chat_id'      => $chat_id,
        'text'         => $message,
        'parse_mode'   => 'HTML',
        'reply_markup' => wp_json_encode($keyboard),
    ));

    // اگر رسید کارت‌به‌کارت پیوست شده، تصویر آن را هم بفرست
    kiya_tg_send_receipt_if_exists($order, $chat_id);
}

/**
 * بررسی و ارسال تصویر رسید پرداخت (در صورت وجود)
 */
function kiya_tg_send_receipt_if_exists($order, $chat_id)
{
    $meta_keys = array('_kiya_receipt_url', '_receipt_image', 'receipt_image', '_bacs_receipt', 'card_to_card_receipt', '_receipt', 'receipt');

    foreach ($meta_keys as $key) {
        $value = $order->get_meta($key);
        if (empty($value)) {
            continue;
        }

        // اگر خودش آدرس تصویر است
        if (filter_var($value, FILTER_VALIDATE_URL)) {
            kiya_tg_api('sendPhoto', array(
                'chat_id' => $chat_id,
                'photo'   => $value,
                'caption' => '📎 رسید پرداخت سفارش #' . $order->get_order_number(),
            ));
            return;
        }

        // اگر شناسهٔ پیوست وردپرس است
        if (is_numeric($value)) {
            $attachment_url = wp_get_attachment_url((int) $value);
            if ($attachment_url) {
                kiya_tg_api('sendPhoto', array(
                    'chat_id'    => $chat_id,
                    'photo'      => $attachment_url,
                    'caption'    => '📎 رسید پرداخت سفارش #' . $order->get_order_number(),
                ));
                return;
            }
        }
    }
}

add_action('woocommerce_new_order', 'kiya_tg_notify_order', 20, 1);
add_action('woocommerce_order_status_changed', function ($order_id, $old, $new) {
    // اطلاع‌رسانی تغییر وضعیت مهم به مدیر
    if (in_array($new, array('cancelled', 'refunded', 'failed'), true)) {
        $chat_id = kiya_get_option('tg_admin_chat');
        if ($chat_id && function_exists('wc_get_order')) {
            $order = wc_get_order($order_id);
            if ($order) {
                kiya_tg_api('sendMessage', array(
                    'chat_id'    => $chat_id,
                    'text'       => '⚠️ سفارش #' . $order->get_order_number() . ' به وضعیت «' . wc_get_order_status_name($new) . '» تغییر کرد.',
                ));
            }
        }
    }
}, 20, 3);

/* ============================================================
 *  ۵. وب‌هوک: دریافت کلیک دکمه‌ها از تلگرام
 * ============================================================ */

function kiya_tg_secret()
{
    $secret = kiya_get_option('tg_secret');
    if (!$secret) {
        $secret = wp_generate_password(20, false, false);
        update_option('kiya_tg_secret', $secret);
    }
    return $secret;
}

/**
 * نقطهٔ پایانی وب‌هوک:  https://your-site.com/?kiya_tg_webhook=SECRET
 */
add_action('init', function () {
    if (empty($_GET['kiya_tg_webhook'])) {
        return;
    }
    if (!hash_equals(kiya_tg_secret(), sanitize_text_field(wp_unslash($_GET['kiya_tg_webhook'])))) {
        status_header(403);
        exit;
    }

    $input  = file_get_contents('php://input');
    $update = json_decode($input, true);

    if (!empty($update['callback_query'])) {
        kiya_tg_handle_callback($update['callback_query']);
    } elseif (!empty($update['message']['text'])) {
        kiya_tg_handle_message($update['message']);
    }

    status_header(200);
    exit;
});

function kiya_tg_handle_callback($query)
{
    $data   = isset($query['data']) ? $query['data'] : '';
    $chat   = isset($query['message']['chat']['id']) ? $query['message']['chat']['id'] : '';
    $msg_id = isset($query['message']['message_id']) ? $query['message']['message_id'] : '';
    $cb_id  = isset($query['id']) ? $query['id'] : '';

    // قالب: kiya_<action>_<order_id>_<secret>
    if (strpos($data, 'kiya_') !== 0) {
        return;
    }

    $parts = explode('_', $data);
    if (count($parts) < 4) {
        return;
    }

    $action   = $parts[1];
    $order_id = absint($parts[2]);
    $secret   = $parts[3];

    if (!hash_equals(kiya_tg_secret(), $secret) || !function_exists('wc_get_order')) {
        kiya_tg_api('answerCallbackQuery', array('callback_query_id' => $cb_id, 'text' => '⛔ دسترسی نامعتبر', 'show_alert' => true));
        return;
    }

    $order = wc_get_order($order_id);
    if (!$order) {
        kiya_tg_api('answerCallbackQuery', array('callback_query_id' => $cb_id, 'text' => 'سفارش پیدا نشد', 'show_alert' => true));
        return;
    }

    $map = array(
        'pay'        => array('status' => 'processing', 'payment' => true,  'text' => '✅ پرداخت تأیید شد'),
        'processing' => array('status' => 'processing', 'payment' => false, 'text' => '📦 در حال آماده‌سازی'),
        'completed'  => array('status' => 'completed',  'payment' => false, 'text' => '🚚 ارسال شد'),
        'cancel'     => array('status' => 'cancelled',  'payment' => false, 'text' => '❌ سفارش لغو شد'),
    );

    if (!isset($map[$action])) {
        return;
    }

    $config = $map[$action];
    $order->update_status($config['status']);
    if (!empty($config['payment'])) {
        $order->update_meta_data('_paid_via_telegram', current_time('mysql'));
        $order->set_date_paid(current_time('mysql'));
        $order->save();
    }
    if ($action === 'cancel') {
        // بازگرداندن موجودی
        if (function_exists('wc_increase_stock_levels') || function_exists('wc_maybe_increase_stock_levels')) {
            wc_increase_stock_levels($order_id);
        }
    }

    kiya_tg_api('answerCallbackQuery', array(
        'callback_query_id' => $cb_id,
        'text'              => $config['text'] . ' — سفارش #' . $order->get_order_number(),
    ));

    // ویرایش پیام اصلی و حذف دکمه‌ها
    if ($chat && $msg_id) {
        kiya_tg_api('editMessageReplyMarkup', array(
            'chat_id'       => $chat,
            'message_id'    => $msg_id,
            'reply_markup'  => wp_json_encode(array('inline_keyboard' => array())),
        ));
    }
}

function kiya_tg_handle_message($message)
{
    $chat_id = isset($message['chat']['id']) ? $message['chat']['id'] : '';
    $text    = isset($message['text']) ? trim($message['text']) : '';

    if (!$chat_id) {
        return;
    }

    if ($text === '/start' || $text === '/help') {
        kiya_tg_api('sendMessage', array(
            'chat_id' => $chat_id,
            'text'    => "سلام به ربات کیا خوش آمدید 👋\n\n"
                . "این ربات برای اطلاع‌رسانی سفارش‌هاست.\n"
                . "برای خرید از سایت استفاده کنید: " . home_url() . "\n\n"
                . "هر سفارش جدید اینجا با دکمه‌های تأیید نمایش داده می‌شود.",
        ));
    }
}

/**
 * تنظیم وب‌هوک تلگرام (دکمهٔ «تنظیم وب‌هوک» در پنل)
 */
function kiya_tg_set_webhook()
{
    $url = add_query_arg('kiya_tg_webhook', kiya_tg_secret(), home_url('/'));
    return kiya_tg_api('setWebhook', array('url' => $url));
}

/* ============================================================
 *  ۶. صفحهٔ تنظیمات در پنل مدیریت
 * ============================================================ */

add_action('admin_menu', function () {
    add_options_page(
        'کیا — تلگرام',
        'کیا تلگرام',
        'manage_options',
        'kiya-telegram',
        'kiya_tg_settings_page'
    );
});

add_action('admin_init', function () {
    register_setting('kiya_tg_settings', 'kiya_tg_token');
    register_setting('kiya_tg_settings', 'kiya_tg_username');
    register_setting('kiya_tg_settings', 'kiya_tg_admin_chat');
});

function kiya_tg_settings_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }

    $notice = '';
    if (isset($_POST['kiya_tg_action'])) {
        check_admin_referer('kiya_tg_settings_action');

        if ($_POST['kiya_tg_action'] === 'webhook') {
            $result = kiya_tg_set_webhook();
            $notice = (is_array($result) && !empty($result['ok']))
                ? '<div class="notice notice-success"><p>✅ وب‌هوک تلگرام با موفقیت تنظیم شد.</p></div>'
                : '<div class="notice notice-error"><p>❌ تنظیم وب‌هوک ناموفق بود. توکن را بررسی کنید.</p></div>';
        } elseif ($_POST['kiya_tg_action'] === 'test') {
            $chat  = kiya_get_option('tg_admin_chat');
            $send  = kiya_tg_api('sendMessage', array('chat_id' => $chat, 'text' => '🔔 پیام آزمایشی از فروشگاه کیا'));
            $notice = (is_array($send) && !empty($send['ok']))
                ? '<div class="notice notice-success"><p>✅ پیام آزمایشی ارسال شد.</p></div>'
                : '<div class="notice notice-error"><p>❌ ارسال ناموفق. آیدی چت را بررسی کنید.</p></div>';
        }
    }
    ?>
    <div class="wrap" dir="rtl">
        <h1>کیا — اتصال تلگرام</h1>
        <?php echo wp_kses_post($notice); ?>
        <form method="post" action="options.php">
            <?php settings_fields('kiya_tg_settings'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">توکن ربات</th>
                    <td>
                        <input type="text" name="kiya_tg_token" value="<?php echo esc_attr(kiya_get_option('tg_token')); ?>" class="regular-text ltr" dir="ltr" placeholder="123456789:AAH...">
                        <p class="description">از <a href="https://t.me/BotFather" target="_blank">@BotFather</a> دستور <code>/newbot</code> را بزنید.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">یوزرنیم ربات</th>
                    <td>
                        <input type="text" name="kiya_tg_username" value="<?php echo esc_attr(kiya_get_option('tg_username')); ?>" class="regular-text ltr" dir="ltr" placeholder="KiyaShopBot">
                        <p class="description">بدون @ — برای دکمهٔ «ورود با تلگرام» لازم است. در BotFather دستور <code>/setdomain</code> را هم اجرا کنید.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">آیدی چت مدیر</th>
                    <td>
                        <input type="text" name="kiya_tg_admin_chat" value="<?php echo esc_attr(kiya_get_option('tg_admin_chat')); ?>" class="regular-text ltr" dir="ltr" placeholder="123456789">
                        <p class="description">از <a href="https://t.me/userinfobot" target="_blank">@userinfobot</a> بگیرید. اعلان سفارش‌ها به این چت می‌رود.</p>
                    </td>
                </tr>
            </table>
            <?php submit_button('ذخیرهٔ تنظیمات'); ?>
        </form>

        <hr>
        <h2>آزمون و فعال‌سازی</h2>
        <form method="post">
            <?php wp_nonce_field('kiya_tg_settings_action'); ?>
            <p>
                <button type="submit" name="kiya_tg_action" value="webhook" class="button button-primary">تنظیم وب‌هوک (فعال‌سازی دکمه‌های تأیید)</button>
                <button type="submit" name="kiya_tg_action" value="test" class="button">ارسال پیام آزمایشی</button>
            </p>
            <p class="description">
                بعد از ذخیرهٔ تنظیمات، یک بار «تنظیم وب‌هوک» را بزنید تا دکمه‌های تأیید پرداخت در تلگرام کار کنند.<br>
                برای نمایش دکمهٔ ورود در هر صفحه: <code>[kiya_telegram_login]</code>
            </p>
        </form>
    </div>
    <?php
}

/* ============================================================
 *  ۷. (اختیاری) ارسال پیامک با کاوه‌نگار
 *  اگر افزونهٔ پیامک ووکامرس فارسی نصب است، این تابع لازم نیست.
 *  فقط اگر خواستی دستی پیامک بفرستی، از این تابع استفاده کن.
 * ============================================================ */

function kiya_send_sms_kavenegar($receptor, $message, $api_key = '')
{
    if (!$api_key || !$receptor) {
        return false;
    }
    $response = wp_remote_get(add_query_arg(array(
        'receptor' => $receptor,
        'message'  => $message,
        'sender'   => '10008663',
    ), 'https://api.kavenegar.com/v1/' . $api_key . '/sms/send.json'), array('timeout' => 15));

    return !is_wp_error($response);
}
