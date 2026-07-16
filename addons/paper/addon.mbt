///|
/// Returns a quiet, high-contrast light theme as declarative MoonBit data.
pub fn contribution() -> @web.Addon {
  @web.addon(
    languages=[],
    themes=[
      @web.theme(
        id="paper",
        name="Paper",
        dark=false,
        foreground="#252525",
        background="#fffdf8",
        selection="#d9e8ff",
        keyword="#9c1c1c",
        type_="#653c9b",
        constant="#1558a6",
        string="#326b35",
        number="#1558a6",
        comment="#737373",
        operator="#9c1c1c",
        function_="#653c9b",
        variable="#252525",
        property="#8a4b08",
        punctuation="#5b5b5b",
      ),
    ],
  )
}
