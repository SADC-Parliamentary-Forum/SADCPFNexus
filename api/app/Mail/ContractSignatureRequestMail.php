<?php

namespace App\Mail;

use App\Models\Contract;
use App\Models\ContractSignatory;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Invites an external counterparty to review and sign a contract via a secure
 * link, and offers the option to register as a supplier to manage signatures.
 */
class ContractSignatureRequestMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Contract $contract,
        public ContractSignatory $signatory,
        public string $signUrl,
        public string $supplierRegisterUrl,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Signature requested: '.$this->contract->reference_number.' — '.$this->contract->title,
        );
    }

    public function content(): Content
    {
        $name = e($this->signatory->signer_name ?: 'Sir/Madam');
        $ref = e((string) $this->contract->reference_number);
        $title = e((string) $this->contract->title);
        $value = e((string) $this->contract->currency).' '.number_format((float) $this->contract->current_value, 2);
        $signUrl = e($this->signUrl);
        $registerUrl = e($this->supplierRegisterUrl);

        $html = <<<HTML
<p>Dear {$name},</p>
<p>The SADC Parliamentary Forum invites you to review and sign the following contract:</p>
<ul>
  <li><strong>Reference:</strong> {$ref}</li>
  <li><strong>Title:</strong> {$title}</li>
  <li><strong>Value:</strong> {$value}</li>
</ul>
<p><a href="{$signUrl}" style="background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Review &amp; sign the contract</a></p>
<p>This is a secure, single-use link. You can review the contract, sign, decline, or request changes.</p>
<hr>
<p style="font-size:13px;color:#555">You may also <a href="{$registerUrl}">register as a supplier</a> to create an account, manage your contracts, and enrol a reusable signature.</p>
<p style="font-size:12px;color:#888">If you did not expect this email, please ignore it. SADC Parliamentary Forum.</p>
HTML;

        return new Content(htmlString: $html);
    }
}
