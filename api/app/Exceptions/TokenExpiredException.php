<?php

namespace App\Exceptions;

use RuntimeException;

class TokenExpiredException extends RuntimeException
{
    public function __construct(string $message = 'This approval link has expired.')
    {
        parent::__construct($message);
    }
}
