<?php

namespace App\Modules\Contracts\Services;

/**
 * Line-level redline diff between two text blocks (PRD §53). Uses a longest-
 * common-subsequence backtrace so the output is a stable sequence of
 * unchanged / added / removed lines suitable for a redline view.
 */
class ContractDiffService
{
    /**
     * @return array{segments: list<array{type: string, text: string}>, added: int, removed: int}
     */
    public function diff(string $before, string $after): array
    {
        $a = $this->lines($before);
        $b = $this->lines($after);

        $segments = $this->lcsDiff($a, $b);
        $added = count(array_filter($segments, fn ($s) => $s['type'] === 'added'));
        $removed = count(array_filter($segments, fn ($s) => $s['type'] === 'removed'));

        return ['segments' => $segments, 'added' => $added, 'removed' => $removed];
    }

    /**
     * Normalise HTML/text into comparable, non-empty trimmed lines.
     *
     * @return list<string>
     */
    private function lines(string $text): array
    {
        // Turn block tags into line breaks, drop remaining markup, decode entities.
        $text = preg_replace('#<\s*(/?)(p|div|br|li|h[1-6]|tr)[^>]*>#i', "\n", $text) ?? $text;
        $text = strip_tags($text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5);

        $lines = preg_split('/\r\n|\r|\n/', $text) ?: [];
        $lines = array_map(fn ($l) => trim(preg_replace('/\s+/', ' ', $l) ?? ''), $lines);

        return array_values(array_filter($lines, fn ($l) => $l !== ''));
    }

    /**
     * @param  list<string>  $a
     * @param  list<string>  $b
     * @return list<array{type: string, text: string}>
     */
    private function lcsDiff(array $a, array $b): array
    {
        $n = count($a);
        $m = count($b);
        // LCS length table.
        $dp = array_fill(0, $n + 1, array_fill(0, $m + 1, 0));
        for ($i = $n - 1; $i >= 0; $i--) {
            for ($j = $m - 1; $j >= 0; $j--) {
                $dp[$i][$j] = $a[$i] === $b[$j]
                    ? $dp[$i + 1][$j + 1] + 1
                    : max($dp[$i + 1][$j], $dp[$i][$j + 1]);
            }
        }

        $segments = [];
        $i = 0;
        $j = 0;
        while ($i < $n && $j < $m) {
            if ($a[$i] === $b[$j]) {
                $segments[] = ['type' => 'unchanged', 'text' => $a[$i]];
                $i++;
                $j++;
            } elseif ($dp[$i + 1][$j] >= $dp[$i][$j + 1]) {
                $segments[] = ['type' => 'removed', 'text' => $a[$i]];
                $i++;
            } else {
                $segments[] = ['type' => 'added', 'text' => $b[$j]];
                $j++;
            }
        }
        while ($i < $n) {
            $segments[] = ['type' => 'removed', 'text' => $a[$i++]];
        }
        while ($j < $m) {
            $segments[] = ['type' => 'added', 'text' => $b[$j++]];
        }

        return $segments;
    }
}
