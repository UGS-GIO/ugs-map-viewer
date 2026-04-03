<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>UCRC Wells</Name>
    <UserStyle>
      <Title>UCRC Wells by Purpose</Title>
      <!-- GeoServer layer: energy_mineral:enmin_ucrc_wells_django_test_current -->
      <!-- Unique-value symbology on "purpose" field -->
      <FeatureTypeStyle>
        <!-- Oil and Gas -->
        <Rule>
          <Name>Oil and Gas</Name>
          <Title>Oil and Gas</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>purpose</ogc:PropertyName>
              <ogc:Literal>Oil and Gas</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill><CssParameter name="fill">#2B83BA</CssParameter></Fill>
                <Stroke>
                  <CssParameter name="stroke">#1A5276</CssParameter>
                  <CssParameter name="stroke-width">0.5</CssParameter>
                </Stroke>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <!-- Mining -->
        <Rule>
          <Name>Mining</Name>
          <Title>Mining</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>purpose</ogc:PropertyName>
              <ogc:Literal>Mining</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill><CssParameter name="fill">#D7191C</CssParameter></Fill>
                <Stroke>
                  <CssParameter name="stroke">#922B21</CssParameter>
                  <CssParameter name="stroke-width">0.5</CssParameter>
                </Stroke>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <!-- Tar Sands -->
        <Rule>
          <Name>Tar Sands</Name>
          <Title>Tar Sands</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>purpose</ogc:PropertyName>
              <ogc:Literal>Tar Sands</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill><CssParameter name="fill">#4B3621</CssParameter></Fill>
                <Stroke>
                  <CssParameter name="stroke">#2C1F13</CssParameter>
                  <CssParameter name="stroke-width">0.5</CssParameter>
                </Stroke>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <!-- Water -->
        <Rule>
          <Name>Water</Name>
          <Title>Water</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>purpose</ogc:PropertyName>
              <ogc:Literal>Water</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill><CssParameter name="fill">#41B6C4</CssParameter></Fill>
                <Stroke>
                  <CssParameter name="stroke">#2C7F8C</CssParameter>
                  <CssParameter name="stroke-width">0.5</CssParameter>
                </Stroke>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <!-- Potash -->
        <Rule>
          <Name>Potash</Name>
          <Title>Potash</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>purpose</ogc:PropertyName>
              <ogc:Literal>Potash</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill><CssParameter name="fill">#E66101</CssParameter></Fill>
                <Stroke>
                  <CssParameter name="stroke">#A04500</CssParameter>
                  <CssParameter name="stroke-width">0.5</CssParameter>
                </Stroke>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <!-- Coal -->
        <Rule>
          <Name>Coal</Name>
          <Title>Coal</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>purpose</ogc:PropertyName>
              <ogc:Literal>Coal</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill><CssParameter name="fill">#333333</CssParameter></Fill>
                <Stroke>
                  <CssParameter name="stroke">#1A1A1A</CssParameter>
                  <CssParameter name="stroke-width">0.5</CssParameter>
                </Stroke>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <!-- Stratigraphy -->
        <Rule>
          <Name>Stratigraphy</Name>
          <Title>Stratigraphy</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>purpose</ogc:PropertyName>
              <ogc:Literal>Stratigraphy</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill><CssParameter name="fill">#7B68EE</CssParameter></Fill>
                <Stroke>
                  <CssParameter name="stroke">#5548A6</CssParameter>
                  <CssParameter name="stroke-width">0.5</CssParameter>
                </Stroke>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <!-- Building or Construction -->
        <Rule>
          <Name>Building or Construction</Name>
          <Title>Building or Construction</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>purpose</ogc:PropertyName>
              <ogc:Literal>Building or Construction</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill><CssParameter name="fill">#FDB863</CssParameter></Fill>
                <Stroke>
                  <CssParameter name="stroke">#B08045</CssParameter>
                  <CssParameter name="stroke-width">0.5</CssParameter>
                </Stroke>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <!-- Oil Shale -->
        <Rule>
          <Name>Oil Shale</Name>
          <Title>Oil Shale</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>purpose</ogc:PropertyName>
              <ogc:Literal>Oil Shale</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill><CssParameter name="fill">#8C6D31</CssParameter></Fill>
                <Stroke>
                  <CssParameter name="stroke">#5E4921</CssParameter>
                  <CssParameter name="stroke-width">0.5</CssParameter>
                </Stroke>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <!-- Geothermal -->
        <Rule>
          <Name>Geothermal</Name>
          <Title>Geothermal</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>purpose</ogc:PropertyName>
              <ogc:Literal>Geothermal</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill><CssParameter name="fill">#E31A1C</CssParameter></Fill>
                <Stroke>
                  <CssParameter name="stroke">#9E1213</CssParameter>
                  <CssParameter name="stroke-width">0.5</CssParameter>
                </Stroke>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <!-- Teaching -->
        <Rule>
          <Name>Teaching</Name>
          <Title>Teaching</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>purpose</ogc:PropertyName>
              <ogc:Literal>Teaching</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill><CssParameter name="fill">#A6D854</CssParameter></Fill>
                <Stroke>
                  <CssParameter name="stroke">#74963B</CssParameter>
                  <CssParameter name="stroke-width">0.5</CssParameter>
                </Stroke>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <!-- Display -->
        <Rule>
          <Name>Display</Name>
          <Title>Display</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>purpose</ogc:PropertyName>
              <ogc:Literal>Display</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill><CssParameter name="fill">#FF69B4</CssParameter></Fill>
                <Stroke>
                  <CssParameter name="stroke">#B3497E</CssParameter>
                  <CssParameter name="stroke-width">0.5</CssParameter>
                </Stroke>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
        <!-- Fallback / Unknown -->
        <Rule>
          <Name>Other</Name>
          <Title>Other / Unknown</Title>
          <ElseFilter/>
          <PointSymbolizer>
            <Graphic>
              <Mark>
                <WellKnownName>circle</WellKnownName>
                <Fill><CssParameter name="fill">#BDBDBD</CssParameter></Fill>
                <Stroke>
                  <CssParameter name="stroke">#858585</CssParameter>
                  <CssParameter name="stroke-width">0.5</CssParameter>
                </Stroke>
              </Mark>
              <Size>8</Size>
            </Graphic>
          </PointSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
