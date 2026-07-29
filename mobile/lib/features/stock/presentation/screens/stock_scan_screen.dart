import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  bool _lookingUp = false;
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
    super.dispose();
  }

  Future<void> _reloadQueue() async {
    final q = await StocktakeDraftQueue.load();
    if (mounted) setState(() => _queue = q);
  }

  Future<void> _lookup() async {
    final barcode = _barcodeCtrl.text.trim();
    if (barcode.isEmpty) return;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgDark,
        title: const Text('Stock scan',
            style: TextStyle(
                color: AppColors.textPrimary, fontWeight: FontWeight.w800)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _barcodeCtrl,
            style: const TextStyle(color: AppColors.textPrimary),
            decoration: const InputDecoration(
              labelText: 'Barcode',
              hintText: 'Scan or type barcode',
            ),
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _lookup(),
          ),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: _lookingUp ? null : _lookup,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: Text(_lookingUp ? 'Looking up…' : 'Lookup barcode',
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
                    'SKU ${_item!['sku'] ?? '—'} · on hand ${_item!['quantity_on_hand'] ?? _item!['qty_on_hand'] ?? '—'}',
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 12),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _qtyCtrl,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: AppColors.textPrimary),
                    decoration:
                        const InputDecoration(labelText: 'Counted qty'),
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
                    'qty ${line.countedQty} · ${line.clientLineKey}',
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 11),
                  ),
                )),
          const SizedBox(height: 8),
          const Text(
            'Queue is stored on-device. Sync to a draft stocktake from web when ready.',
            style: TextStyle(color: AppColors.textMuted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
