import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../core/auth/auth_providers.dart';
import '../../../../../core/offline/draft_database.dart';
import '../../../../../core/offline/draft_provider.dart';
import '../../../../../core/theme/app_theme.dart';

/// Screen to request an asset with justification (and optional doc).
/// Any user with assets.view can request; only managers can add assets.
class AssetRequestScreen extends ConsumerStatefulWidget {
  const AssetRequestScreen({super.key, this.initialJustification});

  final String? initialJustification;

  @override
  ConsumerState<AssetRequestScreen> createState() => _AssetRequestScreenState();
}

class _AssetRequestScreenState extends ConsumerState<AssetRequestScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _justificationController;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _justificationController = TextEditingController(
      text: widget.initialJustification ?? '',
    );
  }

  @override
  void dispose() {
    _justificationController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    final justification = _justificationController.text.trim();
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post<Map<String, dynamic>>(
        '/asset-requests',
        data: {
          'justification': justification,
        },
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Asset request submitted.')),
      );
      context.pop();
    } catch (e) {
      final savedLocally = await _saveDraftOnFailure(justification);
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = savedLocally
            ? 'Failed to submit request. Saved to Offline Drafts so you can retry.'
            : 'Failed to submit request. Please try again.';
      });
    }
  }

  /// Persists the entered justification locally so it is not lost when
  /// submission fails (e.g. no connectivity), following the same
  /// offline-draft pattern used by the other draft-capable request forms.
  Future<bool> _saveDraftOnFailure(String justification) async {
    try {
      final db = ref.read(draftDatabaseProvider);
      await db.into(db.draftEntries).insert(DraftEntriesCompanion.insert(
            type: 'asset_request',
            title: 'Asset request',
            payload: jsonEncode({'justification': justification}),
            createdAt: DateTime.now(),
          ));
      return true;
    } catch (_) {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              size: 18, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Request Asset',
          style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w700),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Submit a request for an asset with a justification. Managers will review and approve.',
                style: TextStyle(color: AppColors.textMuted, fontSize: 14),
              ),
              const SizedBox(height: 24),
              TextFormField(
                controller: _justificationController,
                maxLines: 5,
                maxLength: 2000,
                decoration: const InputDecoration(
                  labelText: 'Justification *',
                  hintText: 'Explain why you need this asset...',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) {
                    return 'Justification is required.';
                  }
                  return null;
                },
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: AppColors.danger)),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Submit Request'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
