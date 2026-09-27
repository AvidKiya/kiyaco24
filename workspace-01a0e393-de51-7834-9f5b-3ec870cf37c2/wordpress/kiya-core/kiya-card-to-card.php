<?php
/**
 * درگاه کارت به کارت اختصاصی کیا
 * شامل: نمایش شماره کارت، آپلود رسید توسط مشتری، ذخیرهٔ امن،
 * تأیید پرداخت از پنل مدیریت و ارسال رسید به ربات تلگرام.
 *
 * @package kiya-core
 */

if (!defined('ABSPATH')) {
    exit;
}

/* ------------------------------------------------------------
 *  ثبت درگاه در ووکامرس
 * ---------------------------------------------------------- */
add_filter('woocommerce_payment_gateways', function ($gateways) {
    $gateways[] = 'KIYA_Card_To_Card';
    return $gateways;
});

/* ------------------------------------------------------------
 *  کلاس درگاه
 * ---------------------------------------------------------- */
class KIYA_Card_To_Card extends WC_Payment_Gateway
{
    public function __construct()
    {
        $this->id                 = 'kiya_c2c';
        $this->method_title       = 'کارت به کارت (کیا)';
        $this->method_description = 'مشتری مبلغ را کارت‌به‌کارت واریز و تصویر رسید را آپلود می‌کند؛ مدیر پس از بررسی، پرداخت را تأیید می‌کند.';
        $this->has_fields         = true;
        $this->icon               = '';

        $this->init_form_fields();
        $this->init_settings();

        $this->title            = $this->get_option('title');
        $this->description      = $this->get_option('description');
        $this->instructions     = $this->get_option('instructions');
        $this->cards            = $this->get_option('cards');
        $this->account_holder   = $this->get_option('account_holder');
        $this->require_receipt  = $this->get_option('require_receipt');
        $this->order_status     = $this->get_option('order_status');

        add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
        add_action('woocommerce_thankyou_' . $this->id, array($this, 'thank_you_instructions'));
    }

    /* ----- فیلدهای تنظیمات پنل ----- */
    public function init_form_fields()
    {
        $this->form_fields = array(
            'enabled' => array(
                'title'   => 'فعال‌سازی',
                'type'    => 'checkbox',
                'label'   => 'فعال‌سازی درگاه کارت به کارت',
                'default' => 'yes',
            ),
            'title' => array(
                'title'       => 'عنوان درگاه',
                'type'        => 'text',
                'description' => 'عنوانی که مشتری در صفحهٔ پرداخت می‌بیند.',
                'default'     => 'کارت به کارت',
                'desc_tip'    => true,
            ),
            'description' => array(
                'title'       => 'توضیح کوتاه',
                'type'        => 'textarea',
                'default'     => 'مبلغ سفارش را به شماره کارت زیر واریز و رسید را آپلود کنید.',
            ),
            'cards' => array(
                'title'       => 'شماره کارت‌ها',
                'type'        => 'textarea',
                'description' => 'هر کارت در یک خط. فرمت: ۶۱۰۴-۳۳۷۸-۰۰۰۰-۰۰۰۰ | بانک ملت | صاحب حساب',
                'default'     => '',
            ),
            'account_holder' => array(
                'title'       => 'نام صاحب حساب',
                'type'        => 'text',
                'default'     => '',
            ),
            'require_receipt' => array(
                'title'       => 'آپلود رسید اجباری باشد؟',
                'type'        => 'checkbox',
                'label'       => 'بله، مشتری بدون آپلود رسید نتواند سفارش ثبت کند',
                'default'     => 'yes',
            ),
            'order_status' => array(
                'title'       => 'وضعیت سفارش بعد از ثبت',
                'type'        => 'select',
                'options'     => array(
                    'on-hold'    => 'در انتظار بررسی (توصیه‌شده)',
                    'pending'    => 'در انتظار پرداخت',
                    'processing' => 'در حال آماده‌سازی',
                ),
                'default'     => 'on-hold',
            ),
            'instructions' => array(
                'title'       => 'راهنمای صفحهٔ سپاسگزاری',
                'type'        => 'textarea',
                'default'     => 'سفارش شما ثبت شد. پس از واریز و آپلود رسید، پرداخت بررسی و تأیید خواهد شد.',
            ),
        );
    }

    /* ----- نمایش در صفحهٔ تسویه ----- */
    public function payment_fields()
    {
        if ($this->description) {
            echo '<p style="font-size:13px;color:#666;margin-bottom:12px">' . esc_html($this->description) . '</p>';
        }

        // کارت‌ها
        $cards = array_filter(array_map('trim', explode("\n", (string) $this->cards)));
        if ($cards) {
            echo '<div class="kiya-cards" style="display:grid;gap:10px;margin-bottom:14px">';
            foreach ($cards as $card) {
                $parts = array_map('trim', explode('|', $card));
                $number = isset($parts[0]) ? $parts[0] : '';
                $bank   = isset($parts[1]) ? $parts[1] : '';
                $holder = isset($parts[2]) ? $parts[2] : $this->account_holder;
                echo '<div style="border:1px dashed #c9a050;border-radius:12px;padding:12px 14px;background:#fdfbf5">';
                echo '<div style="font-weight:700;letter-spacing:1px;direction:ltr;text-align:right">' . esc_html($number) . '</div>';
                if ($bank) {
                    echo '<div style="font-size:12px;color:#888">' . esc_html($bank) . '</div>';
                }
                if ($holder) {
                    echo '<div style="font-size:12px;color:#888">به نام: ' . esc_html($holder) . '</div>';
                }
                echo '</div>';
            }
            echo '</div>';
        }

        // فیلد آپلود رسید
        $required = $this->require_receipt === 'yes' ? ' required' : '';
        echo '<p class="form-row form-row-wide" style="margin-bottom:10px">';
        echo '<label for="kiya_receipt_file">📎 تصویر رسید پرداخت' . ($required ? ' <span style="color:#c00">*</span>' : '') . '</label>';
        echo '<input type="file" id="kiya_receipt_file" name="kiya_receipt_file" accept="image/png,image/jpeg,image/jpg,application/pdf"' . $required . ' style="padding:10px;border:1px solid #ddd;border-radius:10px;width:100%">';
        echo '<small style="color:#888">فرمت JPG/PNG/PDF — حداکثر ۵ مگابایت</small>';
        echo '</p>';

        // شماره پیگیری / چهار رقم آخر کارت
        echo '<p class="form-row form-row-wide">';
        echo '<label for="kiya_receipt_ref">شماره پیگیری یا ۴ رقم آخر کارت (اختیاری)</label>';
        echo '<input type="text" id="kiya_receipt_ref" name="kiya_receipt_ref" maxlength="60" placeholder="مثلاً ۱۲۳۴۵۶۷۸" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:10px">';
        echo '</p>';
    }

    /* ----- اعتبارسنجی ----- */
    public function validate_fields()
    {
        $required = $this->require_receipt === 'yes';

        if ($required) {
            if (empty($_FILES['kiya_receipt_file']) || empty($_FILES['kiya_receipt_file']['name'])) {
                wc_add_notice('لطفاً تصویر رسید پرداخت را آپلود کنید.', 'error');
                return false;
            }
        }

        if (!empty($_FILES['kiya_receipt_file']['name'])) {
            $file = $_FILES['kiya_receipt_file'];

            if ($file['size'] > 5 * 1024 * 1024) {
                wc_add_notice('حجم فایل رسید باید کمتر از ۵ مگابایت باشد.', 'error');
                return false;
            }

            $allowed = array('image/jpeg', 'image/png', 'image/jpg', 'application/pdf');
            $type    = function_exists('mime_content_type') ? mime_content_type($file['tmp_name']) : $file['type'];

            if (!in_array($type, $allowed, true)) {
                wc_add_notice('فرمت رسید باید JPG، PNG یا PDF باشد.', 'error');
                return false;
            }
        }

        return true;
    }

    /* ----- پردازش سفارش ----- */
    public function process_payment($order_id)
    {
        $order = wc_get_order($order_id);

        // شماره پیگیری
        if (!empty($_POST['kiya_receipt_ref'])) {
            $order->update_meta_data('_kiya_receipt_ref', sanitize_text_field(wp_unslash($_POST['kiya_receipt_ref'])));
        }

        // آپلود رسید
        if (!empty($_FILES['kiya_receipt_file']['name'])) {
            $saved = $this->save_receipt($_FILES['kiya_receipt_file']);
            if (is_wp_error($saved)) {
                wc_add_notice('آپلود رسید ناموفق بود: ' . $saved->get_error_message(), 'error');
                return array('result' => 'failure');
            }
            $order->update_meta_data('_kiya_receipt_url', $saved['url']);
            $order->update_meta_data('_kiya_receipt_file', $saved['file']);
        }

        // وضعیت سفارش
        $status = $this->order_status ? $this->order_status : 'on-hold';
        $order->update_status($status, 'سفارش کارت به کارت ثبت شد؛ در انتظار بررسی رسید.');
        $order->save();

        // خالی کردن سبد
        WC()->cart->empty_cart();

        return array(
            'result'   => 'success',
            'redirect' => $this->get_return_url($order),
        );
    }

    /* ----- ذخیرهٔ امن فایل رسید ----- */
    private function save_receipt($file)
    {
        if (!function_exists('wp_handle_upload')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }

        $upload_dir = wp_upload_dir();
        $target_dir = trailingslashit($upload_dir['basedir']) . 'kiya-receipts/' . gmdate('Y/m');
        if (!wp_mkdir_p($target_dir)) {
            return new WP_Error('kiya_mkdir', 'ایجاد پوشهٔ رسیدها ناموفق بود.');
        }

        // جلوگیری از اجرای فایل در پوشهٔ رسیدها
        $htaccess = trailingslashit($upload_dir['basedir']) . 'kiya-receipts/.htaccess';
        if (!file_exists($htaccess)) {
            file_put_contents($htaccess, "Options -Indexes\n<FilesMatch \"\\.(php|phtml|php3|php4|php5|pl|py|cgi|sh)\$\">\nDeny from all\n</FilesMatch>\n");
        }

        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename  = 'receipt-' . wp_generate_password(24, false, false) . '.' . strtolower($extension);

        $upload_dir_filter = function ($dirs) use ($target_dir) {
            $dirs['path'] = $target_dir;
            $dirs['url']  = str_replace($dirs['basedir'], $dirs['baseurl'], $target_dir);
            return $dirs;
        };

        add_filter('upload_dir', $upload_dir_filter, 10, 1);

        $mimes = array(
            'jpg|jpeg|jpe' => 'image/jpeg',
            'png'          => 'image/png',
            'pdf'          => 'application/pdf',
        );
        $result = wp_handle_upload($file, array(
            'test_form'                  => false,
            'mimes'                      => $mimes,
            'unique_filename_callback'   => function () use ($filename) { return $filename; },
        ));

        remove_filter('upload_dir', $upload_dir_filter, 10);

        if (empty($result['file']) || !empty($result['error'])) {
            return new WP_Error('kiya_upload', !empty($result['error']) ? $result['error'] : 'آپلود ناموفق');
        }

        return array(
            'url'  => $result['url'],
            'file' => $result['file'],
        );
    }
}

/* ------------------------------------------------------------
 *  نمایش رسید + دکمهٔ تأیید در پنل مدیریت سفارش
 * ---------------------------------------------------------- */

function kiya_c2c_add_meta_box()
{
    // ثبت روی هر دو حالت ذخیره‌سازی سفارش (کلاسیک و HPOS) — ثبت روی صفحهٔ ناموجود بی‌خطر است
    foreach (array('shop_order', 'woocommerce_page_wc-orders') as $screen) {
        add_meta_box(
            'kiya_c2c_receipt',
            '🧾 رسید پرداخت کارت به کارت',
            'kiya_c2c_render_meta_box',
            $screen,
            'normal',
            'high'
        );
    }
}
add_action('add_meta_boxes', 'kiya_c2c_add_meta_box');

function kiya_c2c_render_meta_box($post_or_order)
{
    $order = $post_or_order instanceof WP_Post ? wc_get_order($post_or_order->ID) : $post_or_order;
    if (!$order) {
        return;
    }

    $url = $order->get_meta('_kiya_receipt_url');
    $ref = $order->get_meta('_kiya_receipt_ref');

    echo '<div style="padding:8px 2px">';

    if (!$url) {
        echo '<p style="color:#888">رسیدی آپلود نشده است.</p>';
    } else {
        if ($ref) {
            echo '<p><strong>شماره پیگیری/۴ رقم آخر:</strong> <span dir="ltr">' . esc_html($ref) . '</span></p>';
        }
        $ext = strtolower(pathinfo($url, PATHINFO_EXTENSION));
        if ($ext === 'pdf') {
            echo '<p><a href="' . esc_url($url) . '" target="_blank" class="button">📄 مشاهدهٔ رسید PDF</a></p>';
        } else {
            echo '<p><a href="' . esc_url($url) . '" target="_blank"><img src="' . esc_url($url) . '" style="max-width:340px;border:1px solid #ddd;border-radius:10px" alt="رسید پرداخت"></a></p>';
        }
    }

    // دکمهٔ تأیید پرداخت
    if ($order->get_payment_method() === 'kiya_c2c' && $order->get_date_paid() === null) {
        echo '<form method="post" style="margin-top:10px">';
        wp_nonce_field('kiya_c2c_confirm_' . $order->get_id(), 'kiya_c2c_nonce');
        echo '<input type="hidden" name="kiya_c2c_order" value="' . esc_attr($order->get_id()) . '">';
        echo '<button type="submit" name="kiya_c2c_confirm" class="button button-primary">✅ تأیید پرداخت و ثبت دریافت وجه</button> ';
        echo '<span style="color:#888;font-size:12px">پس از تأیید، وضعیت سفارش به «در حال آماده‌سازی» تغییر می‌کند.</span>';
        echo '</form>';
    } elseif ($order->get_date_paid()) {
        echo '<p style="color:#3FA46A;font-weight:700">✅ این سفارش قبلاً به‌عنوان پرداخت‌شده تأیید شده است.</p>';
    }

    echo '</div>';
}

/* ----- پردازش تأیید از پنل ----- */
add_action('admin_init', function () {
    if (empty($_POST['kiya_c2c_confirm']) || empty($_POST['kiya_c2c_order'])) {
        return;
    }
    if (!current_user_can('edit_shop_orders')) {
        return;
    }
    if (!wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['kiya_c2c_nonce'] ?? '')), 'kiya_c2c_confirm_' . absint($_POST['kiya_c2c_order']))) {
        return;
    }

    $order = wc_get_order(absint($_POST['kiya_c2c_order']));
    if ($order) {
        $order->set_date_paid(current_time('mysql'));
        $order->update_status('processing', 'پرداخت کارت به کارت توسط مدیر تأیید شد.');
        $order->save();
    }

    wp_safe_redirect(remove_query_arg(array('kiya_c2c_confirm'), wp_get_referer() ?: admin_url()));
    exit;
});

/* ------------------------------------------------------------
 *  پیام صفحهٔ سپاسگزاری
 * ---------------------------------------------------------- */
add_action('woocommerce_thankyou_kiya_c2c', function ($order_id) {
    $order = wc_get_order($order_id);
    if ($order && $order->get_payment_method() === 'kiya_c2c') {
        echo '<p style="background:#fdf6e8;border:1px solid #e8d5a8;padding:12px 16px;border-radius:10px">'
            . 'رسید شما دریافت شد ✅ پس از بررسی توسط فروشگاه، وضعیت پرداخت به‌روز می‌شود.'
            . '</p>';
    }
}, 20, 1);
