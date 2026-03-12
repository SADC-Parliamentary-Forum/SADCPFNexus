/// SADC countries and cities for Travel Requisition dropdowns.
/// Used for Destination Country, City, and From/To location autofill.
class TravelLocations {
  TravelLocations._();

  /// Country name → list of city names (capital + major cities).
  static const Map<String, List<String>> countryCities = {
    'Angola': ['Luanda', 'Lubango', 'Benguela'],
    'Botswana': ['Gaborone', 'Francistown', 'Maun'],
    'Comoros': ['Moroni', 'Mutsamudu'],
    'Democratic Republic of Congo': ['Kinshasa', 'Lubumbashi', 'Goma'],
    'Eswatini': ['Mbabane', 'Manzini', 'Lobamba'],
    'Lesotho': ['Maseru', 'Teyateyaneng', 'Mafeteng'],
    'Madagascar': ['Antananarivo', 'Toamasina', 'Antsirabe'],
    'Malawi': ['Lilongwe', 'Blantyre', 'Mzuzu'],
    'Mauritius': ['Port Louis', 'Curepipe', 'Vacoas-Phoenix'],
    'Mozambique': ['Maputo', 'Beira', 'Nampula'],
    'Namibia': ['Windhoek', 'Walvis Bay', 'Rundu'],
    'Seychelles': ['Victoria', 'Anse Boileau'],
    'South Africa': ['Pretoria', 'Johannesburg', 'Cape Town', 'Durban', 'Bloemfontein'],
    'Tanzania': ['Dar es Salaam', 'Dodoma', 'Arusha', 'Mwanza'],
    'Zambia': ['Lusaka', 'Ndola', 'Kitwe', 'Livingstone'],
    'Zimbabwe': ['Harare', 'Bulawayo', 'Mutare', 'Gweru'],
  };

  /// SADC country names in display order (alphabetical).
  static List<String> get countries =>
      countryCities.keys.toList()..sort((a, b) => a.compareTo(b));

  /// Cities for a given country, or empty if country unknown.
  static List<String> citiesFor(String country) {
    return countryCities[country] ?? [];
  }

  /// Flat list of "City, Country" for From/To dropdowns.
  static List<String> get allLocations {
    final list = <String>[];
    for (final e in countryCities.entries) {
      for (final city in e.value) {
        list.add('$city, ${e.key}');
      }
    }
    list.sort((a, b) => a.compareTo(b));
    return list;
  }

  /// City-only list for From/To when context is clear (e.g. same country).
  static List<String> get allCities {
    final set = <String>{};
    for (final cities in countryCities.values) {
      set.addAll(cities);
    }
    return set.toList()..sort((a, b) => a.compareTo(b));
  }
}
