import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/features/assets/data/asset_verification_draft_queue.dart';
import 'package:sadcpf_nexus/features/assets/domain/asset_qr_token.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';
import 'package:sadcpf_nexus/l10n/app_locale.dart';
import 'package:sadcpf_nexus/l10n/app_strings.dart';
import 'package:sadcpf_nexus/shared/widgets/stitch_screen.dart';

class AssetScanScreen extends ConsumerStatefulWidget {
  const AssetScanScreen({super.key, this.initialToken});

  final String? initialToken;

  @override
  ConsumerState<AssetScanScreen> createState() => _AssetScanScreenState();
}

class _AssetScanScreenState extends ConsumerState<AssetScanScreen> {
  final _tokenCtrl = TextEditingController();
  final _campaignCtrl = TextEditingController();
  bool _lookingUp = false;
  bool _cameraOn = false;
  bool _syncing = false;
  String? _error;
  Map<String, dynamic>? _asset;
  bool _publicOnly = false;
  List<AssetVerificationDraft> _queue = [];

  @override
  void initState() {
    super.initState();
    if (widget.initialToken != null) {
      _tokenCtrl.text = widget.initialToken!;
      WidgetsBinding.instance.addPostFrameCallback((_) => _lookup());
    }
    _reloadQueue();
  }

  @override
  void dispose() {
    _tokenCtrl.dispose();
    _campaignCtrl.dispose();
    super.dispose();
  }

  Future<void> _reloadQueue() async {
    final q = await AssetVerificationDraftQueue.load();
    if (mounted) setState(() => _queue = q);
  }

  Future<void> _lookup([String? override]) async {
    final token = parseAssetQrToken(override ?? _tokenCtrl.text);
    if (token == null) {
      setState(() => _error = 'Could not read that QR token.');
      return;
    }
    _tokenCtrl.text = token;
    setState(() {
      _lookingUp = true;
      _error = null;
      _asset = null;
      _publicOnly = false;
    });
    final dio = ref.read(apiClientProvider).dio;
    try {
      final res = await dio.get('/assets/qr/${Uri.encodeComponent(token)}');
      if (!mounted) return;
      setState(() {
        _asset = extractObjectData(res.data);
        _lookingUp = false;
        _cameraOn = false;
      });
    } catch (_) {
      try {
        final pub = await dio.get('/public/assets/${Uri.encodeComponent(token)}');
        if (!mounted) return;
        setState(() {
          _asset = extractObjectData(pub.data);
          _publicOnly = true;
          _lookingUp = false;
          _cameraOn = false;
        });
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _error = 'No asset matches this label.';
          _lookingUp = false;
        });
      }
    }
  }

  Future<void> _enqueue(String result) async {
    final asset = _asset;
    final campaignId = int.tryParse(_campaignCtrl.text.trim()) ?? 0;
    final assetId = (asset?['id'] as num?)?.toInt();
    if (asset == null || assetId == null || campaignId <= 0) return;
    await AssetVerificationDraftQueue.enqueue(
      AssetVerificationDraft(
        clientLineKey: 'mobile-${DateTime.now().millisecondsSinceEpoch}',
        campaignId: campaignId,
        assetId: assetId,
        result: result,
        queuedAt: DateTime.now().toIso8601String(),
        token: _tokenCtrl.text,
      ),
    );
    await _reloadQueue();
  }

  Future<void> _syncQueue() async {
    setState(() => _syncing = true);
    final dio = ref.read(apiClientProvider).dio;
    final pending = await AssetVerificationDraftQueue.load();
    for (final line in pending) {
      try {
        await dio.post(
          '/assets-meta/verification-campaigns/${line.campaignId}/results',
          data: {
            'asset_id': line.assetId,
            'result': line.result,
            'verification_method': 'qr',
          },
        );
      } catch (_) {
        // Keep remaining items if the device is still offline.
        if (mounted) setState(() => _syncing = false);
        return;
      }
    }
    await AssetVerificationDraftQueue.clear();
    await _reloadQueue();
    if (mounted) setState(() => _syncing = false);
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(ref.watch(appLanguageProvider));
    final tag = (_asset?['asset_tag'] ?? _asset?['assetNumber'] ?? '').toString();
    final name = (_asset?['name'] ?? _asset?['asset_name'] ?? '').toString();
    return StitchScreen(
      title: strings.t('Scan Asset'),
      fallbackRoute: '/assets/inventory',
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _tokenCtrl,
            decoration: const InputDecoration(
              labelText: 'Paste token or /a/{token} URL',
            ),
            onSubmitted: _lookup,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              FilledButton(
                onPressed: _lookingUp ? null : () => _lookup(),
                child: Text(_lookingUp ? 'Looking up…' : 'Look up'),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: () => setState(() => _cameraOn = !_cameraOn),
                child: Text(_cameraOn ? 'Hide camera' : 'Scan'),
              ),
            ],
          ),
          if (_cameraOn) ...[
            const SizedBox(height: 12),
            SizedBox(
              height: 240,
              child: MobileScanner(
                onDetect: (capture) {
                  final value = capture.barcodes.first.rawValue;
                  if (value != null) {
                    _lookup(value);
                  }
                },
              ),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ],
          if (_asset != null) ...[
            const SizedBox(height: 16),
            Text(tag, style: const TextStyle(fontFamily: 'monospace', fontSize: 20)),
            Text(name),
            if ((_asset?['notice'] ?? '').toString().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_asset!['notice'].toString()),
              ),
            if (!_publicOnly && _asset?['id'] != null)
              TextButton(
                onPressed: () => context.push('/assets/inventory'),
                child: const Text('Open register'),
              ),
            if (!_publicOnly) ...[
              TextField(
                controller: _campaignCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Verification campaign ID',
                ),
              ),
              Wrap(
                spacing: 8,
                children: [
                  TextButton(onPressed: () => _enqueue('verified'), child: const Text('Verified')),
                  TextButton(onPressed: () => _enqueue('wrong_location'), child: const Text('Wrong location')),
                  TextButton(onPressed: () => _enqueue('missing'), child: const Text('Missing')),
                ],
              ),
            ],
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Text('Offline queue (${_queue.length})'),
              const Spacer(),
              TextButton(
                onPressed: _syncing || _queue.isEmpty ? null : _syncQueue,
                child: Text(_syncing ? 'Syncing…' : 'Sync'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
