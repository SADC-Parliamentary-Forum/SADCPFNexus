<?php

namespace App\Modules\Notifications\Services;

/**
 * Resolves SMS / WhatsApp drivers. Default remains Null until operator env is set.
 */
class OutboundChannelResolver
{
    public function sms(): NullSmsProvider|HttpChannelProvider
    {
        if ((string) config('notifications.sms_provider', 'null') === 'http') {
            return new HttpChannelProvider(
                'sms',
                'notifications.sms_http_url',
                'notifications.sms_http_token',
                'http_sms',
            );
        }

        return app(NullSmsProvider::class);
    }

    public function whatsapp(): NullWhatsAppProvider|HttpChannelProvider
    {
        if ((string) config('notifications.whatsapp_provider', 'null') === 'http') {
            return new HttpChannelProvider(
                'whatsapp',
                'notifications.whatsapp_http_url',
                'notifications.whatsapp_http_token',
                'http_whatsapp',
            );
        }

        return app(NullWhatsAppProvider::class);
    }
}
