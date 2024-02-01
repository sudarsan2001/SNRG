(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // ../snrg/snrg/public/js/quick_entry.js
  frappe.provide("frappe.ui.form");
  var GSTQuickEntryForm = class extends frappe.ui.form.QuickEntryForm {
    constructor(...args) {
      super(...args);
      this.skip_redirect_on_error = true;
      this.api_enabled = india_compliance.is_api_enabled() && gst_settings.autofill_party_info;
    }
    async setup() {
      await frappe.model.with_doctype("Address");
      super.setup();
    }
    render_dialog() {
      super.render_dialog();
      india_compliance.set_state_options(this.dialog);
    }
    get_address_fields() {
      return [
        {
          label: __("Primary Address Details"),
          fieldname: "primary_address_section",
          fieldtype: "Section Break",
          description: this.api_enabled ? __(
            `When you enter a GSTIN, the permanent address linked to it is
                                autofilled.<br>
                                Change the {0} to autofill other addresses.`,
            [frappe.meta.get_label("Address", "pincode")]
          ) : "",
          collapsible: 0
        },
        {
          fieldname: "_pincode",
          fieldtype: "Autocomplete",
          ignore_validation: true
        },
        {
          fieldname: "address_line1",
          fieldtype: "Data"
        },
        {
          fieldname: "address_line2",
          fieldtype: "Data"
        },
        {
          fieldtype: "Column Break"
        },
        {
          fieldname: "city",
          fieldtype: "Data"
        },
        {
          fieldname: "state",
          fieldtype: "Autocomplete",
          ignore_validation: true
        },
        {
          fieldname: "country",
          fieldtype: "Link",
          options: "Country",
          default: frappe.defaults.get_user_default("country"),
          onchange: () => {
            india_compliance.set_state_options(this.dialog);
          }
        }
      ];
    }
    get_gstin_field() {
      return [
        __spreadProps(__spreadValues({}, frappe.meta.get_docfield(this.doctype, "gstin")), {
          label: "GSTIN",
          fieldname: "_gstin",
          fieldtype: "Autocomplete",
          description: this.api_enabled ? get_gstin_description() : "",
          ignore_validation: true,
          onchange: () => {
            const d = this.dialog;
            if (this.api_enabled && !gst_settings.sandbox_mode)
              return autofill_fields(d);
            d.set_value(
              "gst_category",
              india_compliance.guess_gst_category(d.doc._gstin, d.doc.country)
            );
          }
        })
      ];
    }
    update_doc() {
      const doc = super.update_doc();
      doc.pincode = doc._pincode;
      doc.gstin = doc._gstin;
      return doc;
    }
  };
  var LeadQuickEntryForm = class extends GSTQuickEntryForm {
    get_address_fields() {
      const fields = super.get_address_fields();
      for (const field of fields) {
        const fieldname = field.fieldname === "_pincode" ? "pincode" : field.fieldname;
        if (!field.label && fieldname) {
          field.label = frappe.meta.get_label("Address", fieldname);
        }
      }
      return fields;
    }
    get_mandatory_fields() {
      var fields = [
        {
          label: __("Customer Name"),
          fieldname: "customer_name",
          fieldtype: "Data",
          reqd: 1
        },
        {
          label: __("Organisation Name"),
          fieldname: "company_name",
          fieldtype: "Data"
        },
        {
          label: __("Source"),
          fieldname: "source",
          fieldtype: "Link",
          option: "Lead Source"
        }
      ];
      return fields;
    }
    render_dialog() {
      this.mandatory = [
        ...this.get_gstin_field(),
        ...this.mandatory = this.get_mandatory_fields(),
        ...this.get_contact_fields(),
        ...this.get_address_fields()
      ];
      if (this.doctype === "Customer") {
        this.mandatory.push({
          label: __("Customer POS ID"),
          fieldname: "customer_pos_id",
          fieldtype: "Data",
          hidden: 1
        });
      }
      super.render_dialog();
    }
    get_contact_fields() {
      return [
        {
          label: __("Primary Contact Details"),
          fieldname: "primary_contact_section",
          fieldtype: "Section Break",
          collapsible: 0
        },
        {
          label: __("Email ID"),
          fieldname: "_email_id",
          fieldtype: "Data",
          options: "Email"
        },
        {
          fieldtype: "Column Break"
        },
        {
          label: __("Mobile Number"),
          fieldname: "_mobile_no",
          fieldtype: "Data"
        }
      ];
    }
    update_doc() {
      const doc = super.update_doc();
      doc._address_line1 = doc.address_line1;
      delete doc.address_line1;
      doc.email_id = doc._email_id;
      doc.mobile_no = doc._mobile_no;
      return doc;
    }
  };
  frappe.ui.form.LeadQuickEntryForm = LeadQuickEntryForm;
  async function autofill_fields(dialog) {
    const gstin = dialog.doc._gstin;
    const gstin_field = dialog.get_field("_gstin");
    if (!gstin || gstin.length !== 15) {
      const pincode_field = dialog.fields_dict._pincode;
      pincode_field.set_data([]);
      pincode_field.df.onchange = null;
      gstin_field.set_description(get_gstin_description());
      return;
    }
    const gstin_info2 = await get_gstin_info(gstin);
    set_gstin_description(gstin_field, gstin_info2.status);
    map_gstin_info(dialog.doc, gstin_info2);
    dialog.refresh();
    setup_pincode_field(dialog, gstin_info2);
  }
  function set_gstin_description(gstin_field, status) {
    if (!status) {
      gstin_field.set_description("");
      return;
    }
    gstin_field.set_description(india_compliance.get_gstin_status_desc(status));
  }
  function setup_pincode_field(dialog, gstin_info2) {
    if (!gstin_info2.all_addresses)
      return;
    const pincode_field = dialog.fields_dict._pincode;
    pincode_field.set_data(
      gstin_info2.all_addresses.map((address) => {
        return {
          label: address.pincode,
          value: address.pincode,
          description: `${address.address_line1}, ${address.address_line2}, ${address.city}, ${address.state}`
        };
      })
    );
    pincode_field.df.onchange = () => {
      autofill_address(dialog.doc, gstin_info2);
      dialog.refresh();
    };
  }
  function get_gstin_info(gstin, throw_error = true) {
    return frappe.call({
      method: "india_compliance.gst_india.utils.gstin_info.get_gstin_info",
      args: { gstin, throw_error }
    }).then((r) => r.message);
  }
  function map_gstin_info(doc, gstin_info2) {
    if (!gstin_info2)
      return;
    update_lead_info(doc, gstin_info2);
    if (gstin_info2.permanent_address) {
      update_address_info(doc, gstin_info2.permanent_address);
    }
  }
  function update_lead_info(doc, gstin_info2) {
    doc.gstin = doc._gstin;
    doc.gst_category = gstin_info2.gst_category;
    if (!in_list(frappe.boot.gst_lead_types, doc.doctype))
      return;
    const lead_name_field = `${doc.doctype.toLowerCase()}_name`;
    doc[lead_name_field] = gstin_info2.business_name;
  }
  function update_address_info(doc, address) {
    if (!address)
      return;
    Object.assign(doc, address);
    doc._pincode = address.pincode;
  }
  function autofill_address(doc, { all_addresses }) {
    const { _pincode: pincode } = doc;
    if (!pincode || pincode.length !== 6 || !all_addresses)
      return;
    const name_field = `${doc.doctype.toLowerCase()}_first_name`;
    doc[name_field] = gstin_info.customer_name;
    update_address_info(
      doc,
      all_addresses.find((address) => address.pincode == pincode)
    );
  }
  function get_gstin_description() {
    if (!gst_settings.sandbox_mode) {
      return __("Autofill lead information by entering their GSTIN");
    }
    return __("Autofill is not supported in sandbox mode");
  }
})();
//# sourceMappingURL=snrg.bundle.OXOCXCGH.js.map
