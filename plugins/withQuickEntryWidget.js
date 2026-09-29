const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WIDGET_CLASS = 'QuickEntryWidget';
const ACTIVITY_CLASS = 'QuickExpenseActivity';
const DB_RELATIVE_PATH = 'SQLite/meucaixa.db';

const activityKotlin = (packageName) => `package ${packageName}

import android.app.Activity
import android.database.sqlite.SQLiteDatabase
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.Spinner
import android.widget.Toast
import java.io.File
import java.math.BigDecimal
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.Date

private data class CategoryOption(val id: String?, val label: String) {
    override fun toString(): String = label
}

class ${ACTIVITY_CLASS} : Activity() {

    private var amountCents: Long = 0
    private var suppressWatcher = false
    private var categories: List<CategoryOption> = emptyList()
    private var selectedCategoryId: String? = null

    private lateinit var amountInput: EditText
    private lateinit var nameInput: EditText
    private lateinit var categorySpinner: Spinner

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.quick_expense_dialog)
        setFinishOnTouchOutside(true)

        amountInput = findViewById(R.id.quick_amount)
        nameInput = findViewById(R.id.quick_name)
        categorySpinner = findViewById(R.id.quick_category)

        attachMoneyMask()
        loadCategories()

        findViewById<Button>(R.id.quick_cancel).setOnClickListener { finish() }
        findViewById<Button>(R.id.quick_save).setOnClickListener { save() }

        amountInput.requestFocus()
    }

    private fun databaseFile(): File = File(filesDir, "${DB_RELATIVE_PATH}")

    private fun openDatabase(readOnly: Boolean): SQLiteDatabase? {
        val file = databaseFile()
        if (!file.exists()) return null
        val flags = if (readOnly) SQLiteDatabase.OPEN_READONLY else SQLiteDatabase.OPEN_READWRITE
        return try {
            SQLiteDatabase.openDatabase(file.path, null, flags)
        } catch (error: Exception) {
            null
        }
    }

    private fun attachMoneyMask() {
        amountInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}

            override fun afterTextChanged(editable: Editable) {
                if (suppressWatcher) return
                suppressWatcher = true

                val digits = editable.toString().replace(Regex("[^0-9]"), "").take(12)
                amountCents = digits.toLongOrNull() ?: 0L

                val formatted = formatMoney(amountCents)
                editable.replace(0, editable.length, formatted)
                amountInput.setSelection(formatted.length)

                suppressWatcher = false
            }
        })

        amountInput.setText(formatMoney(0))
    }

    private fun formatMoney(cents: Long): String {
        val symbols = DecimalFormatSymbols(Locale("pt", "BR"))
        val formatter = DecimalFormat("#,##0.00", symbols)
        return "R$ " + formatter.format(BigDecimal(cents).movePointLeft(2))
    }

    private fun loadCategories() {
        val db = openDatabase(true)

        if (db == null) {
            categories = listOf(CategoryOption(null, "Sem categoria"))
            bindSpinner()
            return
        }

        val loaded = mutableListOf(CategoryOption(null, "Sem categoria"))

        db.use { database ->
            database.rawQuery(
                "SELECT id, name FROM categories WHERE kind = 'expense' ORDER BY sort_order ASC, name ASC",
                null
            ).use { cursor ->
                while (cursor.moveToNext()) {
                    loaded.add(CategoryOption(cursor.getString(0), cursor.getString(1)))
                }
            }
        }

        categories = loaded
        bindSpinner()
    }

    private fun bindSpinner() {
        val adapter = ArrayAdapter(this, R.layout.quick_expense_spinner_item, categories)
        adapter.setDropDownViewResource(R.layout.quick_expense_spinner_dropdown)
        categorySpinner.adapter = adapter

        categorySpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                selectedCategoryId = categories[position].id
            }

            override fun onNothingSelected(parent: AdapterView<*>?) {
                selectedCategoryId = null
            }
        }
    }

    private fun resolveProfileId(db: SQLiteDatabase): String? {
        var profileId: String? = null

        db.rawQuery("SELECT value FROM settings WHERE key = 'active_profile_id'", null).use { cursor ->
            if (cursor.moveToFirst()) profileId = cursor.getString(0)
        }

        if (profileId == null || profileId == "ALL") profileId = null

        if (profileId != null) {
            db.rawQuery("SELECT id FROM profiles WHERE id = ?", arrayOf(profileId)).use { cursor ->
                if (!cursor.moveToFirst()) profileId = null
            }
        }

        if (profileId == null) {
            db.rawQuery("SELECT id FROM profiles ORDER BY sort_order ASC LIMIT 1", null).use { cursor ->
                if (cursor.moveToFirst()) profileId = cursor.getString(0)
            }
        }

        return profileId
    }

    private fun createId(): String {
        val time = java.lang.Long.toString(System.currentTimeMillis(), 36)
        val random = java.lang.Long.toString((Math.random() * 1e12).toLong(), 36)
        return time + random
    }

    private fun isoTimestamp(): String {
        val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        format.timeZone = TimeZone.getTimeZone("UTC")
        return format.format(Date())
    }

    private fun todayIso(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    private fun save() {
        if (amountCents <= 0) {
            Toast.makeText(this, "Digite um valor maior que zero", Toast.LENGTH_SHORT).show()
            return
        }

        val db = openDatabase(false)

        if (db == null) {
            Toast.makeText(this, "Abra o Meu Caixa uma vez antes de usar o widget", Toast.LENGTH_LONG).show()
            return
        }

        val description = nameInput.text.toString().trim().ifEmpty { "Gasto" }
        val today = todayIso()
        val competence = today.substring(0, 7)
        val timestamp = isoTimestamp()

        try {
            db.use { database ->
                val profileId = resolveProfileId(database)

                if (profileId == null) {
                    Toast.makeText(this, "Nenhum perfil encontrado", Toast.LENGTH_LONG).show()
                    return
                }

                val commitmentId = createId()
                val occurrenceId = createId()

                database.beginTransaction()
                try {
                    database.execSQL(
                        "INSERT INTO commitments (id, profile_id, category_id, kind, type, description," +
                            " amount, installments, start_date, end_date, day_of_month, notes," +
                            " is_investment, archived, created_at, updated_at)" +
                            " VALUES (?, ?, ?, 'expense', 'single', ?, ?, NULL, ?, NULL, NULL, NULL, 0, 0, ?, ?)",
                        arrayOf(
                            commitmentId, profileId, selectedCategoryId, description,
                            amountCents, today, timestamp, timestamp
                        )
                    )

                    database.execSQL(
                        "INSERT INTO occurrences (id, commitment_id, profile_id, kind, competence," +
                            " due_date, amount, installment_index, status, paid_at, is_overridden, is_investment)" +
                            " VALUES (?, ?, ?, 'expense', ?, ?, ?, NULL, 'pending', NULL, 0, 0)",
                        arrayOf(occurrenceId, commitmentId, profileId, competence, today, amountCents)
                    )

                    database.setTransactionSuccessful()
                } finally {
                    database.endTransaction()
                }
            }
        } catch (error: Exception) {
            Toast.makeText(this, "Não foi possível salvar", Toast.LENGTH_LONG).show()
            return
        }

        Toast.makeText(this, formatMoney(amountCents) + " lançado", Toast.LENGTH_SHORT).show()
        finish()
    }
}
`;

const widgetKotlin = (packageName, scheme) => `package ${packageName}

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

class ${WIDGET_CLASS} : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val quickIntent = Intent(context, ${ACTIVITY_CLASS}::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }

        val quick = PendingIntent.getActivity(
            context,
            1,
            quickIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val scanIntent = Intent(Intent.ACTION_VIEW, Uri.parse("${scheme}://scan")).apply {
            setPackage(context.packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }

        val scan = PendingIntent.getActivity(
            context,
            2,
            scanIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.quick_entry_widget)
            views.setOnClickPendingIntent(R.id.widget_button, quick)
            views.setOnClickPendingIntent(R.id.widget_scan, scan)
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}
`;

const widgetLayout = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="horizontal">

    <TextView
        android:id="@+id/widget_button"
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1"
        android:layout_marginEnd="6dp"
        android:gravity="center"
        android:text="+  Lançar"
        android:textColor="#E8EEF5"
        android:textSize="15sp"
        android:textStyle="bold"
        android:background="@drawable/quick_entry_widget_background" />

    <TextView
        android:id="@+id/widget_scan"
        android:layout_width="56dp"
        android:layout_height="match_parent"
        android:gravity="center"
        android:text="\\uD83D\\uDCF7"
        android:textSize="20sp"
        android:contentDescription="@string/quick_entry_scan_description"
        android:background="@drawable/quick_entry_scan_background" />
</LinearLayout>
`;

const dialogLayout = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:padding="24dp"
    android:background="@drawable/quick_expense_background">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Novo gasto"
        android:textColor="#8A9AAD"
        android:textSize="12sp"
        android:letterSpacing="0.08"
        android:layout_marginBottom="12dp" />

    <EditText
        android:id="@+id/quick_amount"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:inputType="number"
        android:textColor="#E8EEF5"
        android:textSize="34sp"
        android:textStyle="bold"
        android:gravity="center"
        android:background="@android:color/transparent"
        android:importantForAutofill="no"
        android:layout_marginBottom="20dp" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Nome"
        android:textColor="#8A9AAD"
        android:textSize="13sp"
        android:layout_marginBottom="6dp" />

    <EditText
        android:id="@+id/quick_name"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:inputType="textCapSentences"
        android:maxLength="60"
        android:hint="Almoço, mercado…"
        android:textColorHint="#5B6B7E"
        android:textColor="#E8EEF5"
        android:textSize="15sp"
        android:paddingHorizontal="14dp"
        android:paddingVertical="12dp"
        android:background="@drawable/quick_expense_field"
        android:importantForAutofill="no"
        android:layout_marginBottom="16dp" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Categoria"
        android:textColor="#8A9AAD"
        android:textSize="13sp"
        android:layout_marginBottom="6dp" />

    <Spinner
        android:id="@+id/quick_category"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:minHeight="48dp"
        android:paddingHorizontal="10dp"
        android:background="@drawable/quick_expense_field"
        android:layout_marginBottom="24dp" />

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="end">

        <Button
            android:id="@+id/quick_cancel"
            android:layout_width="wrap_content"
            android:layout_height="48dp"
            android:text="Cancelar"
            android:textColor="#8A9AAD"
            android:textAllCaps="false"
            android:textSize="15sp"
            android:background="@android:color/transparent"
            android:layout_marginEnd="8dp" />

        <Button
            android:id="@+id/quick_save"
            android:layout_width="wrap_content"
            android:layout_height="48dp"
            android:minWidth="120dp"
            android:text="Salvar"
            android:textColor="#FFFFFF"
            android:textAllCaps="false"
            android:textSize="15sp"
            android:textStyle="bold"
            android:background="@drawable/quick_expense_save" />
    </LinearLayout>
</LinearLayout>
`;

const spinnerItem = (padding) => `<?xml version="1.0" encoding="utf-8"?>
<TextView xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:minHeight="48dp"
    android:gravity="center_vertical"
    android:paddingHorizontal="${padding}"
    android:textColor="#E8EEF5"
    android:textSize="15sp"
    android:background="@drawable/quick_expense_dropdown" />
`;

const shape = (fill, stroke, radius) => `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="${fill}" />
    <stroke android:width="1dp" android:color="${stroke}" />
    <corners android:radius="${radius}" />
</shape>
`;

const solid = (fill, radius) => `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="${fill}" />
    <corners android:radius="${radius}" />
</shape>
`;

const dialogTheme = `
  <style name="Theme.QuickExpense" parent="@android:style/Theme.Material.Dialog.NoActionBar">
    <item name="android:windowBackground">@android:color/transparent</item>
    <item name="android:windowIsTranslucent">true</item>
    <item name="android:windowCloseOnTouchOutside">true</item>
    <item name="android:backgroundDimAmount">0.6</item>
    <item name="android:windowSoftInputMode">adjustResize|stateVisible</item>
  </style>`;

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

const withNativeFiles = (config) =>
  withDangerousMod(config, [
    'android',
    async (mod) => {
      const projectRoot = mod.modRequest.platformProjectRoot;
      const packageName = AndroidConfig.Package.getPackage(mod);

      if (!packageName) throw new Error('withQuickEntryWidget: android.package não definido');

      const main = path.join(projectRoot, 'app/src/main');
      const javaDir = path.join(main, 'java', ...packageName.split('.'));

      writeFile(path.join(javaDir, `${ACTIVITY_CLASS}.kt`), activityKotlin(packageName));
      const scheme = Array.isArray(mod.scheme) ? mod.scheme[0] : mod.scheme;
      if (!scheme) throw new Error('withQuickEntryWidget: scheme não definido');

      writeFile(path.join(javaDir, `${WIDGET_CLASS}.kt`), widgetKotlin(packageName, scheme));

      writeFile(path.join(main, 'res/layout/quick_entry_widget.xml'), widgetLayout);
      writeFile(path.join(main, 'res/layout/quick_expense_dialog.xml'), dialogLayout);
      writeFile(path.join(main, 'res/layout/quick_expense_spinner_item.xml'), spinnerItem('4dp'));
      writeFile(path.join(main, 'res/layout/quick_expense_spinner_dropdown.xml'), spinnerItem('16dp'));

      writeFile(
        path.join(main, 'res/xml/quick_entry_widget_info.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="40dp"
    android:targetCellWidth="3"
    android:targetCellHeight="1"
    android:resizeMode="horizontal"
    android:widgetCategory="home_screen"
    android:initialLayout="@layout/quick_entry_widget"
    android:previewLayout="@layout/quick_entry_widget"
    android:description="@string/quick_entry_widget_description"
    android:updatePeriodMillis="0" />
`,
      );

      writeFile(
        path.join(main, 'res/drawable/quick_entry_widget_background.xml'),
        shape('#6366F1', '#818CF8', '18dp'),
      );
      writeFile(
        path.join(main, 'res/drawable/quick_entry_scan_background.xml'),
        shape('#151B23', '#253040', '18dp'),
      );
      writeFile(
        path.join(main, 'res/drawable/quick_expense_background.xml'),
        shape('#151B23', '#253040', '24dp'),
      );
      writeFile(
        path.join(main, 'res/drawable/quick_expense_field.xml'),
        shape('#0B0F14', '#253040', '12dp'),
      );
      writeFile(
        path.join(main, 'res/drawable/quick_expense_dropdown.xml'),
        solid('#1A222D', '0dp'),
      );
      writeFile(
        path.join(main, 'res/drawable/quick_expense_save.xml'),
        solid('#6366F1', '12dp'),
      );

      const stringsPath = path.join(main, 'res/values/strings.xml');
      const strings = fs.readFileSync(stringsPath, 'utf8');
      if (!strings.includes('quick_entry_widget_description')) {
        writeFile(
          stringsPath,
          strings.replace(
            '</resources>',
            '  <string name="quick_entry_widget_description">Lançar um gasto ou fotografar a nota</string>\n' +
              '  <string name="quick_entry_scan_description">Fotografar nota fiscal</string>\n</resources>',
          ),
        );
      }

      const stylesPath = path.join(main, 'res/values/styles.xml');
      const styles = fs.readFileSync(stylesPath, 'utf8');
      if (!styles.includes('Theme.QuickExpense')) {
        writeFile(stylesPath, styles.replace('</resources>', `${dialogTheme}\n</resources>`));
      }

      return mod;
    },
  ]);

const withManifestEntries = (config) =>
  withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);

    application.activity = (application.activity ?? []).filter(
      (item) => item.$?.['android:name'] !== `.${ACTIVITY_CLASS}`,
    );

    application.activity.push({
      $: {
        'android:name': `.${ACTIVITY_CLASS}`,
        'android:exported': 'false',
        'android:theme': '@style/Theme.QuickExpense',
        'android:excludeFromRecents': 'true',
        'android:noHistory': 'true',
        'android:launchMode': 'singleTop',
      },
    });

    application.receiver = (application.receiver ?? []).filter(
      (item) => item.$?.['android:name'] !== `.${WIDGET_CLASS}`,
    );

    application.receiver.push({
      $: {
        'android:name': `.${WIDGET_CLASS}`,
        'android:exported': 'false',
      },
      'intent-filter': [
        { action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.appwidget.provider',
            'android:resource': '@xml/quick_entry_widget_info',
          },
        },
      ],
    });

    return mod;
  });

module.exports = (config) => withManifestEntries(withNativeFiles(config));
