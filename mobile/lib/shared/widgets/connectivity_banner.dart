import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

class ConnectivityBannerOverlay extends StatefulWidget {
  const ConnectivityBannerOverlay({super.key, required this.child});

  final Widget child;

  @override
  State<ConnectivityBannerOverlay> createState() =>
      _ConnectivityBannerOverlayState();
}

class _ConnectivityBannerOverlayState extends State<ConnectivityBannerOverlay> {
  final _connectivity = Connectivity();
  StreamSubscription<ConnectivityResult>? _subscription;
  bool _offline = false;

  @override
  void initState() {
    super.initState();
    _checkInitialConnectivity();
    _subscription =
        _connectivity.onConnectivityChanged.listen(_setConnectivityState);
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  Future<void> _checkInitialConnectivity() async {
    final result = await _connectivity.checkConnectivity();
    if (mounted) _setConnectivityState(result);
  }

  void _setConnectivityState(ConnectivityResult result) {
    final offline = result == ConnectivityResult.none;
    if (offline != _offline && mounted) {
      setState(() => _offline = offline);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return Stack(
      children: [
        Positioned.fill(child: widget.child),
        Positioned(
          left: 16,
          right: 16,
          bottom: bottomInset + 88,
          child: AnimatedSlide(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            offset: _offline ? Offset.zero : const Offset(0, 1.4),
            child: AnimatedOpacity(
              duration: const Duration(milliseconds: 180),
              opacity: _offline ? 1 : 0,
              child: IgnorePointer(
                ignoring: !_offline,
                child: Semantics(
                  liveRegion: true,
                  label:
                      'Offline. Changes may not sync until the connection is restored.',
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: const Color(0xFF7C2D12),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.18),
                          blurRadius: 18,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Padding(
                      padding:
                          EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      child: Row(
                        children: [
                          Icon(Icons.wifi_off_rounded,
                              size: 18, color: Colors.white),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Offline. Changes may not sync until you reconnect.',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
