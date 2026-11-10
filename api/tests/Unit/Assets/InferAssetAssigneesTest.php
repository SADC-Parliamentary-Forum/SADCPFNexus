<?php

namespace Tests\Unit\Assets;

use App\Console\Commands\InferAssetAssigneesCommand as Infer;
use App\Models\User;
use PHPUnit\Framework\TestCase;

class InferAssetAssigneesTest extends TestCase
{
    private function people(array $hay): array
    {
        return array_values(array_unique(array_column(Infer::match($hay), 'person')));
    }

    public function test_codes_in_the_name_or_location_identify_the_staff_member(): void
    {
        $this->assertSame(['Boemo Sekgoma'], $this->people(['location' => 'SG-BS Office']));
        $this->assertSame(['Boemo Sekgoma'], $this->people(['name' => 'Laptop - Eros Weg']));
        $this->assertSame(['Paulina Kanguatjivi'], $this->people(['location' => 'PK-Reception']));
        $this->assertSame(['Lorenda Boois'], $this->people(['description' => 'Vostro 5490 - Laptop for Ms. L. Boois']));
        $this->assertSame(['Samuel Bokosi'], $this->people(['name' => 'HP Elitebook - Sam B']));
        $this->assertSame(['Ronald Windwaai'], $this->people(['name' => 'Desktop RW']));
        $this->assertSame(['Ronald Windwaai'], $this->people(['name' => 'Laptop R Windwaai']));
    }

    public function test_short_codes_do_not_match_inside_other_words_or_in_lower_case(): void
    {
        $this->assertSame([], $this->people(['name' => 'Minutes of the RWPC meeting']));
        $this->assertSame([], $this->people(['name' => 'Palm tree print, Pedrosa chair']));
        $this->assertSame([], $this->people(['location' => 'Store room, rw shelf']));
        $this->assertSame([], $this->people(['name' => 'Samsung TV']));
    }

    public function test_two_different_people_are_both_reported(): void
    {
        $this->assertSame(['Toivo Mwaala', 'Agnes Lilungwe'], $this->people(['name' => 'Shared printer TMM / ALM']));
    }

    public function test_user_lookup_is_exact_or_a_single_clear_surname_match(): void
    {
        $users = collect([
            $this->user(1, 'Ronald Windwaai'),
            $this->user(2, 'Samueleni Kauvee'),
            $this->user(3, 'Peter Mungandi'),
            $this->user(4, 'Paula Mungandi'),
        ]);

        $this->assertSame(1, Infer::findUser('Ronald Windwaai', $users)?->id);
        $this->assertSame(2, Infer::findUser('Samueline Kauvee', $users)?->id);
        $this->assertNull(Infer::findUser('Yapoka Mungandi', $users));
        $this->assertNull(Infer::findUser('Clare Musonda', $users));
    }

    private function user(int $id, string $name): User
    {
        return (new User)->forceFill(['id' => $id, 'name' => $name]);
    }
}
