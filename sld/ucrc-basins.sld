<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>UCRC Basins</Name>
    <UserStyle>
      <Title>UCRC Basins</Title>
      <!-- Source: ArcGIS Core_Locations_Supporting_Data/FeatureServer/0 -->
      <!-- Unique value renderer on Label field — Paradox purple, Uinta blue -->
      <!-- GeoServer layer: enmin_ucrc_basins_current -->
      <FeatureTypeStyle>
        <!-- Paradox Basin -->
        <Rule>
          <Name>Paradox Basin</Name>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>label</ogc:PropertyName>
              <ogc:Literal>Paradox Basin</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#8400A8</CssParameter>
              <CssParameter name="stroke-width">2</CssParameter>
            </Stroke>
          </LineSymbolizer>
          <TextSymbolizer>
            <Label>
              <ogc:PropertyName>label</ogc:PropertyName>
            </Label>
            <Font>
              <CssParameter name="font-family">Arial</CssParameter>
              <CssParameter name="font-size">9</CssParameter>
              <CssParameter name="font-style">italic</CssParameter>
              <CssParameter name="font-weight">bold</CssParameter>
            </Font>
            <Fill>
              <CssParameter name="fill">#8400A8</CssParameter>
            </Fill>
          </TextSymbolizer>
        </Rule>
        <!-- Uinta Basin -->
        <Rule>
          <Name>Uinta Basin</Name>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>label</ogc:PropertyName>
              <ogc:Literal>Uinta Basin</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#005CE6</CssParameter>
              <CssParameter name="stroke-width">2</CssParameter>
            </Stroke>
          </LineSymbolizer>
          <TextSymbolizer>
            <Label>
              <ogc:PropertyName>label</ogc:PropertyName>
            </Label>
            <Font>
              <CssParameter name="font-family">Arial</CssParameter>
              <CssParameter name="font-size">9</CssParameter>
              <CssParameter name="font-style">italic</CssParameter>
              <CssParameter name="font-weight">bold</CssParameter>
            </Font>
            <Fill>
              <CssParameter name="fill">#005CE6</CssParameter>
            </Fill>
          </TextSymbolizer>
        </Rule>
        <!-- Fallback for any other basins -->
        <Rule>
          <Name>Other</Name>
          <ElseFilter/>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#808080</CssParameter>
              <CssParameter name="stroke-width">2</CssParameter>
            </Stroke>
          </LineSymbolizer>
          <TextSymbolizer>
            <Label>
              <ogc:PropertyName>label</ogc:PropertyName>
            </Label>
            <Font>
              <CssParameter name="font-family">Arial</CssParameter>
              <CssParameter name="font-size">9</CssParameter>
              <CssParameter name="font-style">italic</CssParameter>
              <CssParameter name="font-weight">bold</CssParameter>
            </Font>
            <Fill>
              <CssParameter name="fill">#808080</CssParameter>
            </Fill>
          </TextSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
