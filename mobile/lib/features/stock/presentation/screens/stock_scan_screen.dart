import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'package:sadcpf_nexus/core/auth/auth_providers.dart';
import 'package:sadcpf_nexus/core/theme/app_theme.dart';
import 'package:sadcpf_nexus/features/procurement/data/procurement_api_helpers.dart';
import 'package:sadcpf_nexus/features/stock/data/stocktake_draft_queue.dart';

class StockScanScreen extends ConsumerStatefulWidget {
  const StockScanScreen({super.key});

  @override
  ConsumerState<StockScanScreen> createState() => _StockScanScreenState();
}

class _StockScanScreenState extends ConsumerState<StockScanScreen> {
  final _barcodeCtrl = TextEditingController();
  final _qtyCtrl = TextEditingController(text: '1');
  final _stocktakeIdCtrl = TextEditingController();
  bool _lookingUp = false;
  bool _cameraOn = false;
  bool _syncing = false;
  String? _error;
  Map<String, dynamic>? _item;
  List<StocktakeDraftLine> _queue = [];

  @override
  void initState() {
    super.initState();
    _reloadQueue();
  }

  @override
  void dispose() {
    _barcodeCtrl.dispose();
    _qtyCtrl.dispose();
    _stocktakeIdCtrl.dispose();
    super.dispose();
  }

  Future<void> _reloadQueue() async {
    final q = await StocktakeDraftQueue.load();
    if (mounted) setState(() => _queue = q);
  }

  Future<void> _lookup([String? override]) async {
    final barcode = (override ?? _barcodeCtrl.text).trim();
    if (barcode.isEmpty) return;
    if (override != null) _barcodeCtrl.text = barcode;
    setState(() {
      _lookingUp = true;
      _error = null;
      _item = null;
    });
    try {
      final dio = ref.read(apiClientProvider).dio;
      final encoded = Uri.encodeComponent(barcode);
      final res = await dio.get('/stock/items/by-barcode/$encoded');
      if (!mounted) return;
      setState(() {
        _item = extractObjectData(res.data);
        _lookingUp = false;
        _cameraOn = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'No stock item for barcode "$barcode".';
        _lookingUp = false;
      });
    }
  }

  Future<void> _enqueue() async {
    final item = _item;
    if (item == null) return;
    final qty = double.tryParse(_qtyCtrl.text.trim()) ?? 1;
    final line = StocktakeDraftLine(
      clientLineKey: 'mobile-${DateTime.now().millisecondsSinceEpoch}',
      stockItemId: item['id'] as int?,
      barcode: item['barcode']?.toString() ?? _barcodeCtrl.text.trim(),
      sku: item['sku']?.toString(),
      name: item['name']?.toString() ?? item['description']?.toString(),
      countedQty: qty,
      queuedAt: DateTime.now().toIso8601String(),
    );
    await StocktakeDraftQueue.enqueue(line);
    await _reloadQueue();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Queued for stocktake sync.')),
      );
    }
  }

  Future<void> _syncOffline() async {
    final id = int.tryParse(_stocktakeIdCtrl.text.trim());
    if (id == null || _queue.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text(
                'Enter a draft stocktake id and queue at least one line.')),
      );
      return;
    }
    setState(() => _syncing = true);
    try {
      final dio = ref.read(apiClientProvider).dio;
      await dio.post('/stock/stocktakes/$id/sync-offline', data: {
        'lines': _queue
            .map((l) => {
                  'client_line_key': l.clientLineKey,
                  'stock_item_id': l.stockItemId,
                  'barcode': l.barcode,
                  'counted_qty': l.countedQty.round(),
                })
            .toList(),
      });
      await StocktakeDraftQueue.clear();
      await _reloadQueue();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Offline queue synced to server.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Sync failed. Check your connection and try again.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        title: const Text('Stock scan',
            style: TextStyle(
                color: AppColors.textPrimary, fontWeight: FontWeight.w800)),
        actions: [
          TextButton(
            onPressed: () => setState(() => _cameraOn = !_cameraOn),
            child: Text(_cameraOn ? 'Manual' : 'Camera',
                style: const TextStyle(color: AppColors.primary)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_cameraOn) ...[
            SizedBox(
              height: 220,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: MobileScanner(
                  onDetect: (capture) {
                    final code = (capture.barcodes.isNotEmpty
                        ? capture.barcodes.first.rawValue
                        : null);
                    if (code != null && code.isNotEmpty && !_lookingUp) {
                      _lookup(code);
                    }
                  },
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
          TextField(
            controller: _barcodeCtrl,
            style: const TextStyle(color: AppColors.textPrimary),
            decoration: const InputDecoration(
              labelText: 'Barcode',
              hintText: 'Scan with camera or type barcode',
            ),
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _lookup(),
          ),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: _lookingUp ? null : _lookup,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: Text(_lookingUp ? 'Looking upâ€¦' : 'Lookup barcode',
                style: const TextStyle(color: Colors.white)),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: AppColors.danger)),
          ],
          if (_item != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_item!['name']?.toString() ?? 'Item',
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w800,
                          fontSize: 16)),
                  const SizedBox(height: 6),
                  Text(
                    'SKU ${_item!['sku'] ?? 'â€”'} Â· on hand ${_item!['quantity_on_hand'] ?? _item!['qty_on_hand'] ?? 'â€”'}',
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 12),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _qtyCtrl,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: AppColors.textPrimary),
                    decoration: const InputDecoration(labelText: 'Counted qty'),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _enqueue,
                    style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary),
                    child: const Text('Queue stocktake line',
                        style: TextStyle(color: Colors.white)),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 24),
          Row(
            children: [
              const Expanded(
                child: Text('Draft stocktake queue',
                    style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700)),
              ),
              TextButton(
                onPressed: () async {
                  await StocktakeDraftQueue.clear();
                  await _reloadQueue();
                },
                child: const Text('Clear'),
              ),
            ],
          ),
          if (_queue.isEmpty)
            const Text('No queued counts yet.',
                style: TextStyle(color: AppColors.textMuted))
          else
            ..._queue.map((line) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(line.name ?? line.barcode,
                      style: const TextStyle(color: AppColors.textPrimary)),
                  subtitle: Text(
                    'qty ${line.countedQty} Â· ${line.clientLineKey}',
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 11),
                  ),
                )),
          const SizedBox(height: 12),
          TextField(
            controller: _stocktakeIdCtrl,
            keyboardType: TextInputType.number,
            style: const TextStyle(color: AppColors.textPrimary),
            decoration: const InputDecoration(
              labelText: 'Draft stocktake ID',
              hintText: 'Required to auto-apply queue to server',
            ),
          ),
          const SizedBox(height: 8),
          ElevatedButton(
            onPressed: _syncing || _queue.isEmpty ? null : _syncOffline,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: Text(
                _syncing ? 'Syncingâ€¦' : 'Sync offline queue to server',
                style: const TextStyle(color: Colors.white)),
          ),
          const SizedBox(height: 8),
          const Text(
            'Camera scan preferred; manual entry always available. Conflicts on the server require force from web if counts already differ.',
            style: TextStyle(color: AppColors.textMuted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
