<?php

namespace App\Exceptions;

use RuntimeException;

class TokenUsedException extends RuntimeException
{
    public function __construct(string $message = 'This approval link has already been used.')
    {
        parent::__construct($message);
    }
}
