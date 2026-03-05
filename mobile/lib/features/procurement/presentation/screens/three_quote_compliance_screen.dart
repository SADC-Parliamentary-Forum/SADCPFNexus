import 'package:flutter/material.dart';
import '../../../../../core/theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  DATA MODELS
// ─────────────────────────────────────────────────────────────────────────────
class _VendorQuote {
  final String name;
  final double amount;
  final bool isCompliant;
  final String validity;
  final String delivery;

  const _VendorQuote({
    required this.name,
    required this.amount,
    required this.isCompliant,
    required this.validity,
    required this.delivery,
  });
}

class _QuoteDoc {
  final String fileName;
  const _QuoteDoc({required this.fileName});
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────────────────────────────────────
class ThreeQuoteComplianceScreen extends StatefulWidget {
  const ThreeQuoteComplianceScreen({super.key});

  @override
  State<ThreeQuoteComplianceScreen> createState() =>
      _ThreeQuoteComplianceScreenState();
}

class _ThreeQuoteComplianceScreenState
    extends State<ThreeQuoteComplianceScreen> {
  int _selectedVendorIndex = 0;
  final _recommendationCtrl = TextEditingController();
  bool _certified = false;

  static const List<_VendorQuote> _vendors = [
    _VendorQuote(
      name: 'TechSolutions Ltd',
      amount: 12500,
      isCompliant: true,
      validity: '30 Days',
      delivery: '2 Weeks',
    ),
    _VendorQuote(
      name: 'Global Systems Inc',
      amount: 13200,
      isCompliant: false,
      validity: '45 Days',
      delivery: '1 Week',
    ),
    _VendorQuote(
      name: 'Apex Networks',
      amount: 11900,
      isCompliant: false,
      validity: '5 Days',
      delivery: '4 Weeks',
    ),
  ];

  static const List<_QuoteDoc> _docs = [
    _QuoteDoc(fileName: 'Quote_TechSolutions_FINAL.pdf'),
    _QuoteDoc(fileName: 'Global_Systems_Quote_0925.pdf'),
    _QuoteDoc(fileName: 'Apex_Quote_Signed.pdf'),
  ];

  @override
  void dispose() {
    _recommendationCtrl.dispose();
    super.dispose();
  }

  String _fmtCurrency(double v) {
    return '\$${v.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: AppColors.textPrimary, size: 18),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text(
          'Compliance Review',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                  color: AppColors.success.withValues(alpha: 0.4)),
            ),
            child: const Text(
              'Submitted',
              style: TextStyle(
                color: AppColors.success,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
        children: [
          // ── Vendor Analysis Header ────────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Vendor Analysis',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    '3 Validated Quotes',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: () {},
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(Icons.download_rounded, size: 14),
                label: const Text('Export',
                    style: TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // ── Vendor Cards ──────────────────────────────────────────────
          ..._vendors.asMap().entries.map((e) => _VendorCard(
                quote: e.value,
                isSelected: _selectedVendorIndex == e.key,
                fmtCurrency: _fmtCurrency,
              )),
          const SizedBox(height: 20),

          // ── Document Evidence ─────────────────────────────────────────
          const Row(
            children: [
              Text(
                'Document Evidence',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              SizedBox(width: 8),
              _CompletionBadge(label: '3/3 Complete'),
            ],
          ),
          const SizedBox(height: 12),
          ..._docs.map((d) => _DocRow(doc: d)),
          const SizedBox(height: 20),

          // ── Recommendation ─────────────────────────────────────────────
          const Text(
            'Recommendation',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.bgSurface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Selected Vendor',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 8),
                _VendorDropdown(
                  vendors: _vendors,
                  selectedIndex: _selectedVendorIndex,
                  onChanged: (i) => setState(() => _selectedVendorIndex = i),
                  fmtCurrency: _fmtCurrency,
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _recommendationCtrl,
                  maxLines: 3,
                  style: const TextStyle(
                      color: AppColors.textPrimary, fontSize: 13),
                  decoration: InputDecoration(
                    hintText:
                        'Explain why this vendor offers the best value...',
                    hintStyle: const TextStyle(
                        color: AppColors.textMuted, fontSize: 12),
                    filled: true,
                    fillColor: AppColors.bgDark,
                    contentPadding: const EdgeInsets.all(12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide:
                          const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide:
                          const BorderSide(color: AppColors.border),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(
                          color: AppColors.primary, width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 22,
                      height: 22,
                      child: Checkbox(
                        value: _certified,
                        onChanged: (v) =>
                            setState(() => _certified = v ?? false),
                        fillColor: WidgetStateProperty.resolveWith(
                            (s) => s.contains(WidgetState.selected)
                                ? AppColors.primary
                                : AppColors.bgDark),
                        checkColor: AppColors.bgDark,
                        side: const BorderSide(
                            color: AppColors.border, width: 1.5),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(4)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'I certify that this procurement is administered by SADC and complies with all applicable procurement policies and procedures.',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                          height: 1.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: _certified ? () {} : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.bgDark,
                disabledBackgroundColor:
                    AppColors.primary.withValues(alpha: 0.35),
                elevation: 0,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text(
                'Submit for Approval',
                style:
                    TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  VENDOR CARD
// ─────────────────────────────────────────────────────────────────────────────
class _VendorCard extends StatelessWidget {
  final _VendorQuote quote;
  final bool isSelected;
  final String Function(double) fmtCurrency;

  const _VendorCard({
    required this.quote,
    required this.isSelected,
    required this.fmtCurrency,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: quote.isCompliant
              ? AppColors.success.withValues(alpha: 0.5)
              : AppColors.border,
          width: quote.isCompliant ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  quote.name,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (quote.isCompliant)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: AppColors.success.withValues(alpha: 0.4)),
                  ),
                  child: const Text(
                    'COMPLIANT',
                    style: TextStyle(
                      color: AppColors.success,
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.bgDark,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Text(
                    'QUOTE',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            fmtCurrency(quote.amount),
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _QuoteStat(label: 'Validity', value: quote.validity),
              const SizedBox(width: 20),
              _QuoteStat(label: 'Delivery', value: quote.delivery),
            ],
          ),
        ],
      ),
    );
  }
}

class _QuoteStat extends StatelessWidget {
  final String label;
  final String value;
  const _QuoteStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                color: AppColors.textMuted, fontSize: 10)),
        Text(value,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            )),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  DOC ROW
// ─────────────────────────────────────────────────────────────────────────────
class _DocRow extends StatelessWidget {
  final _QuoteDoc doc;
  const _DocRow({required this.doc});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.picture_as_pdf_rounded,
                color: AppColors.danger, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              doc.fileName,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.visibility_outlined,
                color: AppColors.textMuted, size: 18),
            onPressed: () {},
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  VENDOR DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────
class _VendorDropdown extends StatelessWidget {
  final List<_VendorQuote> vendors;
  final int selectedIndex;
  final ValueChanged<int> onChanged;
  final String Function(double) fmtCurrency;

  const _VendorDropdown({
    required this.vendors,
    required this.selectedIndex,
    required this.onChanged,
    required this.fmtCurrency,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.bgDark,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          value: selectedIndex,
          dropdownColor: AppColors.bgSurface,
          icon: const Icon(Icons.keyboard_arrow_down_rounded,
              color: AppColors.textMuted),
          isExpanded: true,
          style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.w500),
          onChanged: (v) {
            if (v != null) onChanged(v);
          },
          items: vendors.asMap().entries
              .map((e) => DropdownMenuItem<int>(
                    value: e.key,
                    child: Text(
                        '${e.value.name} (${fmtCurrency(e.value.amount)})'),
                  ))
              .toList(),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPLETION BADGE
// ─────────────────────────────────────────────────────────────────────────────
class _CompletionBadge extends StatelessWidget {
  final String label;
  const _CompletionBadge({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border:
            Border.all(color: AppColors.success.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: AppColors.success,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
