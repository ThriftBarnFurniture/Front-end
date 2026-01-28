// app/services/components/forms/MarketplaceForm.tsx
"use client";

import { useState } from "react";
import type { Floor, PropertyType, ServiceId, YesNo } from "../../services";
import { FLOOR_OPTIONS, PROPERTY_TYPE_OPTIONS, YES_NO_OPTIONS } from "../../services";
import {
  CheckboxGroup,
  Field,
  Input,
  RadioGroup,
  Row,
  Section,
  Select,
  Textarea,
  HelpPill,
} from "../shared";

export default function MarketplaceForm({ serviceId }: { serviceId: ServiceId }) {
  // Load / unload property details
  const [loadType, setLoadType] = useState<PropertyType>("house");
  const [unloadType, setUnloadType] = useState<PropertyType>("house");
  const [loadFloors, setLoadFloors] = useState<Floor[]>([]);
  const [unloadFloors, setUnloadFloors] = useState<Floor[]>([]);

  const [assemblyDisassembly, setAssemblyDisassembly] = useState<YesNo>("no");

  return (
    <>
      <input
        type="hidden"
        name="service_kind"
        value="marketplace_pickup_delivery"
      />

      <Section
        title="Pickup location"
        description="Where we’re picking the item up from."
      >
        <Row>
          <Field label="Load address" required>
            <Input
              name="marketplace_load_address"
              placeholder="Street, City, Postal Code"
              required
              autoComplete="street-address"
            />
          </Field>

          <Field label="Type" required>
            <Select
              name="marketplace_load_type"
              value={loadType}
              onChange={(e) => setLoadType(e.target.value as PropertyType)}
              required
            >
              {PROPERTY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </Row>

        <Field label="Floors (select all that apply)">
          <CheckboxGroup
            options={FLOOR_OPTIONS}
            value={loadFloors}
            onChange={setLoadFloors}
            columns={2}
          />
          {loadFloors.map((f) => (
            <input
              key={f}
              type="hidden"
              name="marketplace_load_floors[]"
              value={f}
            />
          ))}
        </Field>
      </Section>

      <Section
        title="Delivery location"
        description="Where we’re delivering the item to."
      >
        <Row>
          <Field label="Unload address" required>
            <Input
              name="marketplace_unload_address"
              placeholder="Street, City, Postal Code"
              required
              autoComplete="street-address"
            />
          </Field>

          <Field label="Type" required>
            <Select
              name="marketplace_unload_type"
              value={unloadType}
              onChange={(e) => setUnloadType(e.target.value as PropertyType)}
              required
            >
              {PROPERTY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </Row>

        <Field label="Floors (select all that apply)">
          <CheckboxGroup
            options={FLOOR_OPTIONS}
            value={unloadFloors}
            onChange={setUnloadFloors}
            columns={2}
          />
          {unloadFloors.map((f) => (
            <input
              key={f}
              type="hidden"
              name="marketplace_unload_floors[]"
              value={f}
            />
          ))}
        </Field>
      </Section>

      <Section
        title="Item details"
        description="Add photos and any handling notes so we come prepared."
      >
        <Field label="Assembly / disassembly required?">
          <RadioGroup<YesNo>
            name="marketplace_assembly_disassembly"
            options={YES_NO_OPTIONS}
            value={assemblyDisassembly}
            onChange={setAssemblyDisassembly}
          />
          <input
            type="hidden"
            name="marketplace_assembly_disassembly"
            value={assemblyDisassembly}
          />
        </Field>

        <Field
          label="Upload item photos (optional)"
          hint="Upload screenshots/listing photos so we know size/weight."
        >
          <Input type="file" name="photos" accept="image/*" multiple />
        </Field>

        <Field
          label="Special instructions"
          hint="Pickup contact, parking notes, fragile parts, time constraints, etc."
        >
          <Textarea
            name="marketplace_special_instructions"
            placeholder="Example: seller lives in condo, loading dock available, please call upon arrival..."
          />
        </Field>

        <HelpPill>
          Thanks for the details — a member of the Barn will reach out soon for
          booking!
        </HelpPill>
      </Section>

      <Section
        title="Contact info"
        description="We’ll use this to reach out and to send your confirmation email."
      >
        <Row>
          <Field label="Full name" required>
            <Input name="contact_name" placeholder="Your name" required />
          </Field>

          <Field label="Phone number" required>
            <Input
              name="contact_phone"
              placeholder="(###) ###-####"
              required
              autoComplete="tel"
            />
          </Field>
        </Row>

        <Field label="Email" required>
          <Input
            name="contact_email"
            type="email"
            placeholder="you@email.com"
            required
            autoComplete="email"
          />
        </Field>
      </Section>
    </>
  );
}
