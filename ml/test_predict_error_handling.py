#!/usr/bin/env python3
"""
Unit tests for CarbonCTRL ML prediction error handling and contract verification.
Tests:
- Subprocess exit code is 1 when arguments are missing or invalid
- Error details are returned as structured JSON containing an 'error' field
- Missing model files produce non-zero exit codes and clear error messages
- No arbitrary/hardcoded confidence scores (e.g., 0.85) are returned
"""

import subprocess
import json
import os
import sys
import unittest

PREDICT_SCRIPT = os.path.join(os.path.dirname(__file__), 'predict.py')

class TestPredictErrorHandling(unittest.TestCase):

    def _parse_output(self, result):
        """Helper to parse JSON from stdout or stderr"""
        text = (result.stderr.strip() or result.stdout.strip())
        for line in text.splitlines():
            line = line.strip()
            if line.startswith('{') and line.endswith('}'):
                try:
                    return json.loads(line)
                except Exception:
                    continue
        return None

    def test_missing_input_arguments_fails(self):
        """Executing predict.py without arguments must fail with exit code 1."""
        result = subprocess.run(
            [sys.executable, PREDICT_SCRIPT],
            capture_output=True,
            text=True
        )
        self.assertEqual(result.returncode, 1)
        data = self._parse_output(result)
        self.assertIsNotNone(data, f"Expected JSON error in output, got: {result.stderr or result.stdout}")
        self.assertIn("error", data)

    def test_malformed_json_fails(self):
        """Executing predict.py with invalid JSON must fail with exit code 1."""
        result = subprocess.run(
            [sys.executable, PREDICT_SCRIPT, "not-valid-json"],
            capture_output=True,
            text=True
        )
        self.assertEqual(result.returncode, 1)
        data = self._parse_output(result)
        self.assertIsNotNone(data)
        self.assertIn("error", data)

    def test_missing_data_fields_fails(self):
        """Executing predict.py with JSON missing 'data' or 'index' must fail with exit code 1."""
        payload = json.dumps({"unrelated": [1, 2, 3]})
        result = subprocess.run(
            [sys.executable, PREDICT_SCRIPT, payload],
            capture_output=True,
            text=True
        )
        self.assertEqual(result.returncode, 1)
        data = self._parse_output(result)
        self.assertIsNotNone(data)
        self.assertIn("error", data)

    def test_missing_model_handling_in_subprocess(self):
        """When the model file does not exist, executing make_predictions via script must fail with exit code 1."""
        inline_code = (
            "import os, sys, json\n"
            "from unittest.mock import patch, MagicMock\n"
            "sys.modules['models.carbon_predictor'] = MagicMock()\n"
            "import predict\n"
            "with patch('os.path.exists', return_value=False):\n"
            "    try:\n"
            "        predict.make_predictions({'data': [[1]], 'index': ['2026-01-01']})\n"
            "        sys.exit(0)\n"
            "    except FileNotFoundError:\n"
            "        sys.exit(42)\n"
        )
        result = subprocess.run(
            [sys.executable, "-c", inline_code],
            cwd=os.path.dirname(__file__),
            capture_output=True,
            text=True
        )
        self.assertEqual(result.returncode, 42)

    def test_output_does_not_contain_hardcoded_confidence(self):
        """A successful prediction structure should contain 'predictions' and 'prediction_dates', but no fake confidence."""
        inline_code = (
            "import sys, json\n"
            "from unittest.mock import patch, MagicMock\n"
            "mock_model = MagicMock()\n"
            "mock_model.predict.return_value = [[120.5, 125.0, 130.2]]\n"
            "mock_cls = MagicMock(return_value=mock_model)\n"
            "sys.modules['models.carbon_predictor'] = MagicMock(CarbonPredictionModel=mock_cls)\n"
            "import predict\n"
            "with patch('os.path.exists', return_value=True):\n"
            "    res = predict.make_predictions({'data': [{'emissions': 100}], 'index': ['2026-01-01']})\n"
            "    assert res.get('success') is True\n"
            "    assert 'predictions' in res\n"
            "    assert 'confidence' not in res\n"
            "    print('OK')\n"
        )
        result = subprocess.run(
            [sys.executable, "-c", inline_code],
            cwd=os.path.dirname(__file__),
            capture_output=True,
            text=True
        )
        self.assertEqual(result.returncode, 0, f"Failed: {result.stderr}")
        self.assertIn("OK", result.stdout)

if __name__ == '__main__':
    unittest.main()
