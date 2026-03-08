import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class ReportNewIncidentScreen extends StatefulWidget {
  const ReportNewIncidentScreen({super.key});

  @override
  State<ReportNewIncidentScreen> createState() =>
      _ReportNewIncidentScreenState();
}

class _ReportNewIncidentScreenState extends State<ReportNewIncidentScreen> {
  String? _incidentType;
  String _severity = 'Medium';
  final _descriptionController = TextEditingController();
  final List<String> _witnesses = ['J.Shivac'];
  final _witnessController = TextEditingController();
  bool _hasPdfAttached = true;
  bool _signed = false;

  final List<String> _incidentTypes = [
    'Security Breach',
    'Ethics Violation',
    'Harassment',
    'Asset Misuse',
    'Data Privacy',
    'Other',
  ];

  static const _severities = ['Low', 'Medium', 'High'];

  @override
  void dispose() {
    _descriptionController.dispose();
    _witnessController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: Colors.black87,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'New Incident Report',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1A1A1A),
          ),
        ),
        centerTitle: true,
        actions: [
          TextButton(
            onPressed: () {},
            child: const Text(
              'Drafts',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF13EC80),
              ),
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(32),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: Color(0xFF13EC80),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Text(
                      'STEP 1 OF 3: FILING',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF13EC80),
                        letterSpacing: 0.6,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              // Progress bar
              Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 3,
                      color: const Color(0xFF13EC80),
                    ),
                  ),
                  Expanded(child: Container(height: 3, color: const Color(0xFFE0E0E0))),
                  Expanded(child: Container(height: 3, color: const Color(0xFFE0E0E0))),
                ],
              ),
            ],
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
        children: [
          // ── Classification section ────────────────────────────────────
          const _SectionHeader(label: 'Classification'),
          const SizedBox(height: 12),

          const Text(
            'Incident Type',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF333333)),
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFDDDDDD)),
              borderRadius: BorderRadius.circular(12),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _incidentType,
                isExpanded: true,
                hint: const Text(
                  'Select classification...',
                  style: TextStyle(fontSize: 14, color: Color(0xFFAAAAAA)),
                ),
                icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFF888888)),
                style: const TextStyle(
                  fontSize: 14,
                  color: Color(0xFF1A1A1A),
                ),
                items: _incidentTypes.map((t) {
                  return DropdownMenuItem(value: t, child: Text(t));
                }).toList(),
                onChanged: (v) => setState(() => _incidentType = v),
              ),
            ),
          ),
          const SizedBox(height: 16),

          const Text(
            'Severity Level',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF333333)),
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFDDDDDD)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: _severities.asMap().entries.map((entry) {
                final i = entry.key;
                final s = entry.value;
                final isActive = s == _severity;
                Color activeColor;
                switch (s) {
                  case 'Low':
                    activeColor = const Color(0xFF13EC80);
                    break;
                  case 'Medium':
                    activeColor = const Color(0xFF13EC80);
                    break;
                  case 'High':
                    activeColor = const Color(0xFFEF4444);
                    break;
                  default:
                    activeColor = const Color(0xFF13EC80);
                }

                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _severity = s),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: isActive
                            ? activeColor.withValues(alpha: 0.12)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(11),
                        border: isActive
                            ? Border.all(color: activeColor)
                            : null,
                      ),
                      child: Text(
                        s,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isActive
                              ? FontWeight.w700
                              : FontWeight.w500,
                          color: isActive
                              ? activeColor
                              : const Color(0xFF888888),
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 20),

          // ── Details section ───────────────────────────────────────────
          const _SectionHeader(label: 'Details'),
          const SizedBox(height: 12),

          const Text(
            'Description',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF333333)),
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFDDDDDD)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: TextField(
              controller: _descriptionController,
              maxLines: 5,
              style: const TextStyle(fontSize: 13, color: Color(0xFF1A1A1A)),
              decoration: const InputDecoration(
                hintText:
                    'Provide a detailed account of the incident, including time, location, and parties involved...',
                hintStyle: TextStyle(fontSize: 12, color: Color(0xFFAAAAAA)),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: EdgeInsets.all(14),
              ),
            ),
          ),
          const SizedBox(height: 16),

          const Text(
            'Witnesses (Optional)',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF333333)),
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFDDDDDD)),
              borderRadius: BorderRadius.circular(12),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    ..._witnesses.map((w) => Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEEF9F4),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                                color: const Color(0xFF13EC80)
                                    .withValues(alpha: 0.4)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.person,
                                  size: 12, color: Color(0xFF13EC80)),
                              const SizedBox(width: 4),
                              Text(
                                w,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF0BAE5E),
                                ),
                              ),
                              const SizedBox(width: 4),
                              GestureDetector(
                                onTap: () =>
                                    setState(() => _witnesses.remove(w)),
                                child: const Icon(Icons.close,
                                    size: 12, color: Color(0xFF0BAE5E)),
                              ),
                            ],
                          ),
                        )),
                    SizedBox(
                      width: 120,
                      child: TextField(
                        controller: _witnessController,
                        style: const TextStyle(
                            fontSize: 13, color: Color(0xFF1A1A1A)),
                        decoration: const InputDecoration(
                          hintText: 'Add person...',
                          hintStyle:
                              TextStyle(fontSize: 12, color: Color(0xFFAAAAAA)),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(horizontal: 4),
                          isDense: true,
                        ),
                        onSubmitted: (v) {
                          if (v.trim().isNotEmpty) {
                            setState(() {
                              _witnesses.add(v.trim());
                              _witnessController.clear();
                            });
                          }
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // ── Evidence & Signature section ──────────────────────────────
          const _SectionHeader(label: 'Evidence & Signature'),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: _UploadTile(
                  icon: Icons.camera_alt_outlined,
                  label: 'Take Photo',
                  onTap: () {},
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _UploadTile(
                  icon: Icons.description_outlined,
                  label: 'Upload PDF',
                  onTap: () {},
                ),
              ),
            ],
          ),

          if (_hasPdfAttached) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                    color: const Color(0xFFEF4444).withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.picture_as_pdf,
                      size: 18, color: Color(0xFFEF4444)),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'incident_report_v1.pdf',
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF1A1A1A)),
                        ),
                        Text(
                          'CONFIDENTIAL',
                          style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFFEF4444),
                              letterSpacing: 0.6),
                        ),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: () => setState(() => _hasPdfAttached = false),
                    child: const Icon(Icons.delete_outline,
                        size: 18, color: Color(0xFFEF4444)),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),

          // Officer Signature
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Officer Signature',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF333333)),
              ),
              if (_signed)
                GestureDetector(
                  onTap: () => setState(() => _signed = false),
                  child: const Text(
                    'Clear',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFFEF4444)),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => setState(() => _signed = true),
            child: Container(
              height: 100,
              decoration: BoxDecoration(
                border: Border.all(
                  color: _signed
                      ? const Color(0xFF13EC80)
                      : const Color(0xFFDDDDDD),
                  width: _signed ? 1.5 : 1,
                ),
                borderRadius: BorderRadius.circular(12),
                color: _signed
                    ? const Color(0xFFF0FFF6)
                    : const Color(0xFFFAFAFA),
              ),
              child: _signed
                  ? CustomPaint(
                      painter: _SignaturePainter(),
                      size: Size.infinite,
                    )
                  : const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.gesture, size: 32, color: Color(0xFFCCCCCC)),
                        SizedBox(height: 4),
                        Text(
                          'Tap to sign',
                          style: TextStyle(
                              fontSize: 12, color: Color(0xFFAAAAAA)),
                        ),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'By signing, you confirm the accuracy of this report. Your digital signature is legally binding under SADC SecureID authentication protocol.',
            style: TextStyle(fontSize: 11, color: Color(0xFF999999), height: 1.5),
          ),
          const SizedBox(height: 24),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFEEEEEE))),
        ),
        child: ElevatedButton.icon(
          onPressed: () {},
          icon: const Icon(Icons.send, size: 18),
          label: const Text('Submit Report'),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF13EC80),
            foregroundColor: const Color(0xFF102219),
            minimumSize: const Size(double.infinity, 52),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            elevation: 0,
            textStyle: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  final String label;
  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 3,
          height: 14,
          decoration: BoxDecoration(
            color: const Color(0xFF13EC80),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w800,
            color: Color(0xFF1A1A1A),
            letterSpacing: 0.2,
          ),
        ),
      ],
    );
  }
}

class _UploadTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _UploadTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 20),
        decoration: BoxDecoration(
          border: Border.all(
              color: const Color(0xFF13EC80).withValues(alpha: 0.4),
              style: BorderStyle.solid),
          borderRadius: BorderRadius.circular(12),
          color: const Color(0xFFF0FFF6),
        ),
        child: Column(
          children: [
            Icon(icon, size: 28, color: const Color(0xFF13EC80)),
            const SizedBox(height: 6),
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0BAE5E),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SignaturePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF0BAE5E)
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    final path = Path();
    final w = size.width;
    final h = size.height;

    path.moveTo(w * 0.1, h * 0.6);
    path.cubicTo(w * 0.15, h * 0.3, w * 0.2, h * 0.7, w * 0.25, h * 0.5);
    path.cubicTo(w * 0.3, h * 0.3, w * 0.35, h * 0.7, w * 0.4, h * 0.5);
    path.cubicTo(w * 0.45, h * 0.35, w * 0.5, h * 0.65, w * 0.55, h * 0.5);
    path.cubicTo(w * 0.6, h * 0.35, w * 0.65, h * 0.7, w * 0.7, h * 0.55);
    path.cubicTo(w * 0.75, h * 0.4, w * 0.8, h * 0.6, w * 0.9, h * 0.5);

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
